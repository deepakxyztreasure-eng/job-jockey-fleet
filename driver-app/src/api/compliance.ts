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
  const { error } = await supabase.from('emergency_alerts').insert({
    driver_id: alert.driver_id,
    latitude: alert.latitude,
    longitude: alert.longitude,
    location_address: alert.location_address || null,
    battery_level: alert.battery_level || null,
    status: 'active',
    timestamp: new Date().toISOString(),
  });

  if (error) throw error;

  // Real-time siren notification to Super Admin
  try {
    await supabase.from('notifications').insert({
      title: '🚨🚨 SOS EMERGENCY TRIGGERED 🚨🚨',
      body: `Driver has triggered an emergency SOS at coordinates (${alert.latitude}, ${alert.longitude})`,
      type: 'emergency_sos',
    });
  } catch {}
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
