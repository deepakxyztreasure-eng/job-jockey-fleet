import { supabase } from './supabase';
import { JobMessage } from '../types';

export async function fetchJobMessages(driverId: string, jobId?: string | null): Promise<JobMessage[]> {
  try {
    let query = supabase
      .from('job_messages')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: true });

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('Note on fetching chat messages:', error.message);
      }
      return [];
    }
    return (data || []) as JobMessage[];
  } catch {
    return [];
  }
}

export async function sendChatMessage(
  driverId: string,
  senderId: string,
  senderName: string,
  messageText: string,
  jobId?: string | null,
  attachmentUrl?: string | null
): Promise<JobMessage> {
  const fallbackMsg: JobMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    driver_id: driverId,
    sender_id: senderId,
    sender_name: senderName,
    sender_role: 'driver',
    job_id: jobId || null,
    message_text: messageText,
    attachment_url: attachmentUrl || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('job_messages')
      .insert({
        driver_id: driverId,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: 'driver',
        job_id: jobId || null,
        message_text: messageText,
        attachment_url: attachmentUrl || null,
      })
      .select()
      .single();

    if (!error && data) {
      return data as JobMessage;
    }
    return fallbackMsg;
  } catch {
    return fallbackMsg;
  }
}
