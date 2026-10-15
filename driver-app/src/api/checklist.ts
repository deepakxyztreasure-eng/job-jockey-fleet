import { supabase } from './supabase';
import { ChecklistItemResponse, DriverChecklist } from '../types';

export const MORNING_CHECKLIST_ITEMS = [
  {
    key: 'fitness_to_drive',
    title: 'Stay fit, physically and mentally',
    description: 'No alcohol or impairing drugs. Well-rested and alert to operate heavy vehicle.',
  },
  {
    key: 'vehicle_condition',
    title: 'Vehicle in good working order',
    description: 'Check brakes, brake lines, tyre pressure & tread, coolant, oil, mirrors, lights & emergency kit.',
  },
  {
    key: 'load_security',
    title: 'Check load distribution & security',
    description: 'Ensure load is evenly distributed and properly secured with tarp/cover if required.',
  },
  {
    key: 'documents_devices',
    title: 'Documents & recording devices',
    description: 'Valid driver licence, transport dockets, and required vehicle permits on board.',
  },
  {
    key: 'route_weather',
    title: 'Check route, bridges & weather',
    description: 'Anticipate height/weight restricted bridges, tunnels, low clearances, and planned rest stops.',
  },
];

export const EVENING_CHECKLIST_ITEMS = [
  {
    key: 'fuel_tank',
    title: 'Top up fuel tank',
    description: 'Refuel diesel tank ready for tomorrow morning dispatch.',
  },
  {
    key: 'adblue',
    title: 'Top up AdBlue',
    description: 'Check AdBlue level and top up tank if required.',
  },
  {
    key: 'leaks_inspection',
    title: 'Check truck for leaks or issues',
    description: 'Inspect ground under vehicle for oil, fuel, hydraulic fluid, or coolant drips.',
  },
  {
    key: 'nuts_and_bolts',
    title: 'Check wheel nuts and bolts',
    description: 'Inspect wheel nut indicators and visually verify all mounting bolts are secure.',
  },
  {
    key: 'all_tyres',
    title: 'Check all tyres & pressures',
    description: 'Inspect for embedded rocks, cuts, sidewall bulges, and low tyre pressure.',
  },
  {
    key: 'oil_level',
    title: 'Check engine oil level',
    description: 'Inspect engine dipstick to ensure oil level is within normal operating range.',
  },
  {
    key: 'coolant_level',
    title: 'Check radiator coolant level',
    description: 'Verify coolant reservoir level and check cap seal.',
  },
  {
    key: 'bin_tray_clean',
    title: 'Confirm truck bin/tray is clean',
    description: 'Tip/sweep out residual aggregate, sand, asphalt, or debris from the bin.',
  },
  {
    key: 'morning_load',
    title: 'Confirm morning load scheduled',
    description: 'Confirm if pre-loading is scheduled for the next morning or truck is parked empty.',
  },
];

export const getTodayDateString = () => new Date().toISOString().slice(0, 10);

export async function getTodayChecklistStatus(driverId: string): Promise<{
  morningSubmitted: boolean;
  morningRequiresSignoff: boolean;
  morningSignoffStatus: 'none' | 'pending' | 'approved' | 'rejected';
  morningChecklist?: DriverChecklist | null;
  eveningSubmitted: boolean;
}> {
  const today = getTodayDateString();

  try {
    // Check morning checklist in driver_checklists
    const { data: morning, error: mErr } = await supabase
      .from('driver_checklists')
      .select('*')
      .eq('driver_id', driverId)
      .eq('checklist_type', 'morning')
      .eq('date', today)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mErr && morning) {
      // Check evening checklist
      const { data: evening } = await supabase
        .from('driver_checklists')
        .select('id')
        .eq('driver_id', driverId)
        .eq('checklist_type', 'evening')
        .eq('date', today)
        .limit(1)
        .maybeSingle();

      return {
        morningSubmitted: true,
        morningRequiresSignoff: morning?.requires_signoff || false,
        morningSignoffStatus: morning?.signoff_status || 'none',
        morningChecklist: morning,
        eveningSubmitted: !!evening,
      };
    }
  } catch (err) {
    // Fallback to legacy check
  }

  // Graceful fallback to existing production table driver_checklist_logs
  try {
    const { data: legacyLog } = await supabase
      .from('driver_checklist_logs')
      .select('*')
      .eq('driver_id', driverId)
      .eq('date', today)
      .eq('checklist_completed', true)
      .maybeSingle();

    if (legacyLog) {
      return {
        morningSubmitted: true,
        morningRequiresSignoff: false,
        morningSignoffStatus: 'none',
        morningChecklist: null,
        eveningSubmitted: false,
      };
    }
  } catch (legacyErr) {
    console.warn('Error reading legacy checklist log:', legacyErr);
  }

  return {
    morningSubmitted: false,
    morningRequiresSignoff: false,
    morningSignoffStatus: 'none',
    morningChecklist: null,
    eveningSubmitted: false,
  };
}

export async function submitChecklist(
  driverId: string,
  type: 'morning' | 'evening',
  responses: ChecklistItemResponse[],
  driverName?: string
): Promise<{ success: boolean; requiresSignoff: boolean; message: string }> {
  const today = getTodayDateString();
  const hasNo = responses.some((r) => r.answer === 'no');

  const payload: any = {
    driver_id: driverId,
    checklist_type: type,
    date: today,
    responses,
    requires_signoff: hasNo,
    signoff_status: hasNo ? 'pending' : 'none',
    submitted_at: new Date().toISOString(),
  };

  // 1. Try writing to new driver_checklists table
  try {
    const { error: insertErr } = await supabase.from('driver_checklists').insert(payload);
    if (insertErr) {
      console.warn('driver_checklists insert note (will persist to legacy log):', insertErr.message);
    }
  } catch (err) {
    console.warn('driver_checklists insert warning:', err);
  }

  // 2. Backward compatibility with production web app:
  // Write to driver_checklist_logs so the web app knows the driver is checked in
  if (type === 'morning') {
    try {
      await supabase.from('driver_checklist_logs').upsert(
        {
          driver_id: driverId,
          date: today,
          checklist_completed: true,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id,date' }
      );
    } catch (upsertErr) {
      console.warn('driver_checklist_logs upsert warning:', upsertErr);
    }

    // Notify admins if sign-off is needed
    if (hasNo) {
      try {
        await supabase.from('notifications').insert({
          title: `⚠️ Driver Sign-off Required: ${driverName || 'Driver'}`,
          body: `Driver reported a NO on morning checklist for ${today}. Please review and approve/reject.`,
          type: 'checklist_signoff',
        });
      } catch {}
    }
  }

  return {
    success: true,
    requiresSignoff: hasNo,
    message: hasNo
      ? 'Checklist submitted with defect flags. Waiting for Super Admin sign-off.'
      : 'Checklist completed successfully. Safe travels!',
  };
}
