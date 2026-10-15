import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabase';

const QUEUE_KEY = '@jodha_offline_action_queue';

export interface QueuedAction {
  id: string;
  type: 'job_status' | 'job_completion' | 'checklist' | 'defect' | 'gps_batch';
  payload: any;
  timestamp: string; // Original client physical event timestamp
  retryCount: number;
}

export async function enqueueAction(type: QueuedAction['type'], payload: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? JSON.parse(raw) : [];

    const newAction: QueuedAction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newAction);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Enqueued ${type} action. Queue length: ${queue.length}`);
  } catch (err) {
    console.error('[OfflineQueue] Enqueue error:', err);
  }
}

export async function processQueue(): Promise<{ processed: number; remaining: number }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return { processed: 0, remaining: -1 };
  }

  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return { processed: 0, remaining: 0 };

    const queue: QueuedAction[] = JSON.parse(raw);
    if (queue.length === 0) return { processed: 0, remaining: 0 };

    console.log(`[OfflineQueue] Signal restored. Processing ${queue.length} queued offline actions...`);
    const remaining: QueuedAction[] = [];
    let processed = 0;

    for (const item of queue) {
      try {
        if (item.type === 'job_status') {
          await supabase
            .from('jobs')
            .update({
              status: item.payload.status,
              updated_at: item.timestamp,
            })
            .eq('id', item.payload.jobId);
        } else if (item.type === 'job_completion') {
          await supabase
            .from('jobs')
            .update({
              ...item.payload.data,
              actual_end_time: item.timestamp, // Preserve original black-spot physical delivery time!
            })
            .eq('id', item.payload.jobId);
        } else if (item.type === 'checklist') {
          await supabase.from('driver_checklists').insert({
            ...item.payload,
            submitted_at: item.timestamp,
          });
        } else if (item.type === 'defect') {
          await supabase.from('vehicle_defect_reports').insert({
            ...item.payload,
            reported_at: item.timestamp,
          });
        } else if (item.type === 'gps_batch') {
          await supabase.from('driver_locations').insert(item.payload.locations);
        }

        processed++;
      } catch (e) {
        console.warn(`[OfflineQueue] Action ${item.id} failed, will retry:`, e);
        if (item.retryCount < 5) {
          remaining.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return { processed, remaining: remaining.length };
  } catch (err) {
    console.error('[OfflineQueue] Process queue error:', err);
    return { processed: 0, remaining: 0 };
  }
}

/**
 * Initializes automatic background network listener to drain offline queue
 */
export function initOfflineSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      processQueue();
    }
  });

  return unsubscribe;
}
