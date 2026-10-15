import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../api/supabase';

// Safely configure foreground notifications
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('[NotificationService] setNotificationHandler notice:', e);
}

export async function playAlertSound(type: 'new_job' | 'urgent' | 'fatigue'): Promise<void> {
  try {
    // 1. Vibrate phone aggressively for heavy vehicle cabin noise
    if (type === 'new_job') {
      Vibration.vibrate([0, 500, 200, 500]);
    } else if (type === 'urgent') {
      Vibration.vibrate([0, 800, 300, 800, 300, 800]);
    } else {
      Vibration.vibrate([0, 1000]);
    }

    // 2. Play audio using modern expo-audio if available
    try {
      const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
      if (setAudioModeAsync) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        }).catch(() => {});
      }

      if (createAudioPlayer) {
        const player = createAudioPlayer({
          uri: 'https://cdn.freesound.org/previews/536/536108_11566874-lq.mp3',
        });
        player.play();
      }
    } catch (audioErr) {
      // Graceful fallback to vibration in environments without native audio module
      console.log('[NotificationService] Audio playback notice (vibration active):', audioErr);
    }
  } catch (err) {
    console.warn('[NotificationService] Play alert warning:', err);
  }
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission denied');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (!tokenData?.data) return null;

    const token = tokenData.data;

    // Save token to push_subscriptions
    try {
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: token,
          p256dh: 'expo',
          auth: 'expo',
          user_agent: 'JodhaNativeDriverApp',
        },
        { onConflict: 'endpoint' }
      );
    } catch {}

    return token;
  } catch (err) {
    console.warn('[NotificationService] Register push token warning:', err);
    return null;
  }
}
