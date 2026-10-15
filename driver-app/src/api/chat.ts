import { supabase } from './supabase';
import { JobMessage } from '../types';

export async function fetchJobMessages(driverId: string, jobId?: string | null): Promise<JobMessage[]> {
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
    console.error('Error fetching chat messages:', error);
    return [];
  }
  return (data || []) as JobMessage[];
}

export async function sendChatMessage(
  driverId: string,
  senderId: string,
  senderName: string,
  messageText: string,
  jobId?: string | null,
  attachmentUrl?: string | null
): Promise<JobMessage> {
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

  if (error) throw error;
  return data as JobMessage;
}
