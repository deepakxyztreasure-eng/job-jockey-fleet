import { supabase } from './supabase';
import { Job, JobStop } from '../types';

export async function fetchDriverJobs(driverId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('assigned_driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching driver jobs:', error);
    throw error;
  }

  // Fetch stops for these jobs if multi-stop table exists
  const jobIds = (data || []).map((j: any) => j.id);
  if (jobIds.length > 0) {
    try {
      const { data: stopsData, error: stopsError } = await supabase
        .from('job_stops')
        .select('*')
        .in('job_id', jobIds)
        .order('stop_order', { ascending: true });

      if (!stopsError && stopsData) {
        const stopsByJob = new Map<string, JobStop[]>();
        stopsData.forEach((stop: any) => {
          const list = stopsByJob.get(stop.job_id) || [];
          list.push(stop);
          stopsByJob.set(stop.job_id, list);
        });

        return (data || []).map((j: any) => ({
          ...j,
          stops: stopsByJob.get(j.id) || [],
        })) as Job[];
      }
    } catch {
      // Safe fallback if job_stops table is not yet created
    }
  }

  return (data || []) as Job[];
}

export async function acceptJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'accepted' })
    .eq('id', jobId);

  if (error) throw error;
}

export async function rejectJob(jobId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'rejected',
      assigned_driver_id: null,
      rejection_reason: reason || 'Rejected by driver',
    })
    .eq('id', jobId);

  if (error) throw error;
}

export async function startJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'in_progress',
      actual_start_time: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) throw error;
}

export interface CompleteJobPayload {
  jobId: string;
  notes?: string;
  proofImageUrl?: string | null;
  signatureUrl?: string | null;
  signerName?: string | null;
  pinCode?: string | null;
  weighbridgeDocketUrl?: string | null;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
}

export async function submitJobCompletion(payload: CompleteJobPayload): Promise<void> {
  const baseUpdate: any = {
    status: 'completion_requested',
    completion_notes: payload.notes || null,
    actual_end_time: new Date().toISOString(),
    completion_requested_at: new Date().toISOString(),
  };

  if (payload.proofImageUrl) baseUpdate.proof_image_url = payload.proofImageUrl;

  const fullUpdate: any = { ...baseUpdate };
  if (payload.signatureUrl) fullUpdate.customer_signature_url = payload.signatureUrl;
  if (payload.signerName) fullUpdate.customer_signature_name = payload.signerName;
  if (payload.pinCode) fullUpdate.customer_pin = payload.pinCode;
  if (payload.weighbridgeDocketUrl) fullUpdate.weighbridge_docket_url = payload.weighbridgeDocketUrl;
  if (payload.grossWeight != null) fullUpdate.gross_weight = payload.grossWeight;
  if (payload.tareWeight != null) fullUpdate.tare_weight = payload.tareWeight;
  if (payload.netWeight != null) fullUpdate.net_weight = payload.netWeight;

  const { error } = await supabase
    .from('jobs')
    .update(fullUpdate)
    .eq('id', payload.jobId);

  if (error) {
    console.warn('Full completion update failed (possibly pending migration), falling back to base fields:', error.message);
    const { error: fallbackErr } = await supabase
      .from('jobs')
      .update(baseUpdate)
      .eq('id', payload.jobId);

    if (fallbackErr) throw fallbackErr;
  }
}

export async function updateStopStatus(
  stopId: string,
  status: 'pending' | 'en_route' | 'arrived' | 'completed',
  extra?: { proofUrl?: string; signatureUrl?: string }
): Promise<void> {
  const patch: any = { status };
  if (status === 'arrived') patch.arrived_at = new Date().toISOString();
  if (status === 'completed') {
    patch.completed_at = new Date().toISOString();
    if (extra?.proofUrl) patch.proof_image_url = extra.proofUrl;
    if (extra?.signatureUrl) patch.signature_url = extra.signatureUrl;
  }

  const { error } = await supabase.from('job_stops').update(patch).eq('id', stopId);
  if (error) throw error;
}
