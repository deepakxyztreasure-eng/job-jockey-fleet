import { Platform, Vibration } from 'react-native';
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

// Setup Android notification channel for lock-screen & background delivery
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Jodha Dispatch Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#2563EB',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        sound: 'default',
      });
    } catch (e) {
      console.warn('[NotificationService] Android channel setup warning:', e);
    }
  }
}

// Trigger a native system notification banner immediately on the device
export async function triggerLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    await setupNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: data || {},
      },
      trigger: null, // deliver immediately
    });
  } catch (err) {
    console.warn('[NotificationService] Local notification trigger error:', err);
  }
}

export async function playAlertSound(type: 'new_job' | 'urgent' | 'fatigue'): Promise<void> {
  try {
    // Vibrate phone aggressively for heavy vehicle cabin noise
    if (type === 'new_job') {
      Vibration.vibrate([0, 500, 200, 500]);
    } else if (type === 'urgent') {
      Vibration.vibrate([0, 800, 300, 800, 300, 800]);
    } else {
      Vibration.vibrate([0, 1000]);
    }
  } catch (err) {
    console.warn('[NotificationService] Play alert warning:', err);
  }
}

import Constants from 'expo-constants';

const EAS_PROJECT_ID = '73ff084f-3e4c-4541-b088-21c3085369dd';

export async function registerForPushNotifications(
  userId: string,
  driverId?: string
): Promise<string | null> {
  try {
    await setupNotificationChannels();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Push notification permission denied');
      return null;
    }

    // EAS projectId is mandatory for ExpoPushToken in standalone / Play Store builds
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      EAS_PROJECT_ID;

    let tokenData: Notifications.ExpoPushToken | null = null;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    } catch (pushErr: any) {
      console.warn('[NotificationService] getExpoPushToken error with projectId:', pushErr?.message || pushErr);
      // Fallback try without arguments just in case
      try {
        tokenData = await Notifications.getExpoPushTokenAsync();
      } catch (fallbackErr: any) {
        console.warn('[NotificationService] Fallback getExpoPushToken notice:', fallbackErr?.message || fallbackErr);
      }
    }

    if (!tokenData?.data) {
      console.warn('[NotificationService] No push token returned from Expo');
      return null;
    }

    const token = tokenData.data;
    console.log('[NotificationService] Obtained Expo Push Token:', token);

    // Save token to push_subscriptions
    try {
      const { error: upsertErr } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          driver_id: driverId || null,
          endpoint: token,
          p256dh: 'expo',
          auth: 'expo',
          user_agent: 'JodhaNativeDriverApp',
        },
        { onConflict: 'endpoint' }
      );
      if (upsertErr) {
        console.warn('[NotificationService] push_subscriptions upsert error:', upsertErr.message);
      } else {
        console.log('[NotificationService] Successfully registered push token in push_subscriptions');
      }
    } catch (dbErr) {
      console.warn('[NotificationService] push_subscriptions upsert note:', dbErr);
    }

    return token;
  } catch (err) {
    console.warn('[NotificationService] Register push token warning:', err);
    return null;
  }
}

