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
      console.warn('Push notification permission denied');
      return null;
    }

    let tokenData: Notifications.ExpoPushToken | null = null;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync();
    } catch (pushErr: any) {
      console.warn('[NotificationService] getExpoPushToken notice:', pushErr?.message || pushErr);
    }

    if (!tokenData?.data) return null;

    const token = tokenData.data;

    // Save token to push_subscriptions
    try {
      await supabase.from('push_subscriptions').upsert(
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
    } catch (dbErr) {
      console.warn('[NotificationService] push_subscriptions upsert note:', dbErr);
    }

    return token;
  } catch (err) {
    console.warn('[NotificationService] Register push token warning:', err);
    return null;
  }
}
