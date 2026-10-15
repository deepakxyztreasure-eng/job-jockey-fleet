import { supabase } from './supabase';
import { VehicleDefectReport, FatigueLog, EmergencyAlert } from '../types';

export async function submitDefectReport(report: VehicleDefectReport): Promise<void> {
  const { error } = await supabase.from('vehicle_defect_reports').insert({
    driver_id: report.driver_id,
    vehicle: report.vehicle,
    job_id: report.job_id || null,
    defect_type: report.defect_type,
    severity: report.severity,
    description: report.description,
    photo_urls: report.photo_urls || [],
    status: 'open',
    reported_at: new Date().toISOString(),
  });

  if (error) throw error;

  // Insert high priority notification to dispatch
  try {
    await supabase.from('notifications').insert({
      title: `🚨 Vehicle Defect Reported (${report.severity.toUpperCase()})`,
      body: `${report.defect_type.toUpperCase()}: ${report.description}`,
      type: 'vehicle_defect',
    });
  } catch {}
}

export async function logFatigueEvent(event: FatigueLog): Promise<void> {
  const { error } = await supabase.from('fatigue_logs').insert({
    driver_id: event.driver_id,
    event_type: event.event_type,
    start_time: event.start_time,
    end_time: event.end_time || null,
    duration_minutes: event.duration_minutes || null,
    location_lat: event.location_lat || null,
    location_lng: event.location_lng || null,
  });

  if (error) throw error;
}

export async function triggerEmergencySOS(alert: EmergencyAlert): Promise<void> {
  // 1. Fetch driver profile info for rich emergency dispatch
  let driverName = "Driver";
  let driverPhone = "";
  try {
    const { data: drv } = await supabase
      .from('drivers')
      .select('full_name, phone, vehicle')
      .eq('id', alert.driver_id)
      .maybeSingle();
    if (drv) {
      driverName = drv.full_name || 'Driver';
      driverPhone = drv.phone || '';
    }
  } catch {}

  const emergencyPayload = {
    driver_id: alert.driver_id,
    driver_name: driverName,
    driver_phone: driverPhone,
    latitude: alert.latitude,
    longitude: alert.longitude,
    location_address: alert.location_address || null,
    battery_level: alert.battery_level || null,
    status: 'active',
    timestamp: new Date().toISOString(),
  };

  // 2. Insert into emergency_alerts table
  try {
    const { error } = await supabase.from('emergency_alerts').insert(emergencyPayload);
    if (error) console.warn('[EmergencySOS] Table insert notice:', error.message);
  } catch (err) {
    console.warn('[EmergencySOS] Table insert exception:', err);
  }

  // 3. Direct Realtime WebSocket broadcast to ALL connected dispatch & admin consoles
  try {
    const sosChannel = supabase.channel('dispatch-emergency-broadcast');
    sosChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        sosChannel.send({
          type: 'broadcast',
          event: 'emergency_sos',
          payload: emergencyPayload,
        });
        setTimeout(() => supabase.removeChannel(sosChannel), 3000);
      }
    });
  } catch (bcErr) {
    console.warn('[EmergencySOS] Broadcast notice:', bcErr);
  }

  // 4. Insert notifications for each super_admin and dispatch_admin user
  try {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['super_admin', 'dispatch_admin']);

    if (adminRoles && adminRoles.length > 0) {
      const notifRows = adminRoles.map((r: any) => ({
        user_id: r.user_id,
        title: '🚨🚨 EMERGENCY SOS TRIGGERED 🚨🚨',
        body: `${driverName} pressed emergency SOS! Coordinates: (${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)})`,
        type: 'emergency_sos',
      }));
      await supabase.from('notifications').insert(notifRows);

      // 5. Fire lock-screen push notifications to admin devices
      const adminIds = adminRoles.map((r: any) => r.user_id);
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint')
        .in('user_id', adminIds);

      const tokens = (subs || [])
        .filter((s: any) => s.endpoint?.startsWith('ExponentPushToken'))
        .map((s: any) => s.endpoint);

      if (tokens.length > 0) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            tokens.map((to) => ({
              to,
              sound: 'default',
              title: '🚨🚨 EMERGENCY SOS TRIGGERED 🚨🚨',
              body: `${driverName} pressed SOS! Coordinates: ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}`,
              priority: 'high',
              channelId: 'default',
            }))
          ),
        }).catch(() => {});
      }
    }
  } catch (notifErr) {
    console.warn('[EmergencySOS] Admin notification notice:', notifErr);
  }
}

export async function fetchDriverCertifications(driverId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('driver_certifications')
    .select('*')
    .eq('driver_id', driverId)
    .order('expiry_date', { ascending: true });

  if (error) {
    console.warn('Could not load certifications:', error.message);
    return [];
  }
  return data || [];
}
