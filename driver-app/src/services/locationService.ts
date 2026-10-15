import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../api/supabase';
import { enqueueAction } from './offlineQueue';

export const LOCATION_TASK_NAME = 'jodha-background-location-task';

let activeDriverId: string | null = null;
let activeJobId: string | null = null;

// Adaptive interval threshold values
const MOVING_SPEED_MPS = 4.16; // ~15 km/h
const MOVING_INTERVAL_MS = 15000; // 15 seconds
const STATIONARY_INTERVAL_MS = 90000; // 90 seconds

/**
 * Configure background location task callback
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[LocationTask] Background location error:', error);
    return;
  }
  if (!data || !activeDriverId) return;

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  const loc = locations[locations.length - 1]; // Latest fix
  const speedKmh = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0;
  const isMoving = speedKmh > 10;

  const locationPoint = {
    driver_id: activeDriverId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    heading: loc.coords.heading || null,
    speed: speedKmh,
    accuracy: loc.coords.accuracy || null,
    is_moving: isMoving,
    current_job_id: activeJobId,
    recorded_at: new Date(loc.timestamp).toISOString(),
  };

  await saveLocationFix(locationPoint);
});

async function saveLocationFix(point: any) {
  try {
    const { error: insertError } = await supabase.from('driver_locations').insert(point);
    if (insertError) {
      const basePoint = {
        driver_id: point.driver_id,
        latitude: point.latitude,
        longitude: point.longitude,
        recorded_at: point.recorded_at,
      };
      const { error: baseErr } = await supabase.from('driver_locations').insert(basePoint);
      if (baseErr) {
        await enqueueAction('gps_batch', { locations: [point] });
      }
    }
  } catch {
    await enqueueAction('gps_batch', { locations: [point] });
  }
}

let foregroundSubscription: Location.LocationSubscription | null = null;

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    return fgStatus === 'granted';
  } catch {
    return false;
  }
}

export async function startAdaptiveTracking(driverId: string, jobId?: string | null): Promise<boolean> {
  activeDriverId = driverId;
  activeJobId = jobId || null;

  try {
    const hasPerm = await requestLocationPermissions();
    if (!hasPerm) {
      console.warn('[LocationService] Foreground location permission not granted');
      return false;
    }

    // Try background location first if available in standalone builds
    let bgGranted = false;
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      bgGranted = bgStatus === 'granted';
    } catch {
      bgGranted = false;
    }

    if (bgGranted) {
      try {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: MOVING_INTERVAL_MS,
          distanceInterval: 25, // meters
          deferredUpdatesInterval: MOVING_INTERVAL_MS,
          deferredUpdatesDistance: 25,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Jodha Fleet Tracking',
            notificationBody: 'Active delivery route & safety compliance tracking',
            notificationColor: '#0f172a',
          },
        });
        console.log('[LocationService] Adaptive background tracking started for driver:', driverId);
        return true;
      } catch (bgErr) {
        console.warn('[LocationService] Background task unavailable, using foreground watcher fallback:', bgErr);
      }
    }

    // Foreground location watcher fallback (works perfectly in Expo Go)
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }

    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: MOVING_INTERVAL_MS,
        distanceInterval: 25,
      },
      async (loc) => {
        if (!activeDriverId) return;
        const speedKmh = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0;
        const locationPoint = {
          driver_id: activeDriverId,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading || null,
          speed: speedKmh,
          accuracy: loc.coords.accuracy || null,
          is_moving: speedKmh > 10,
          current_job_id: activeJobId,
          recorded_at: new Date(loc.timestamp).toISOString(),
        };

        await saveLocationFix(locationPoint);
      }
    );

    console.log('[LocationService] Adaptive foreground tracking active for driver:', driverId);
    return true;
  } catch (err) {
    console.warn('[LocationService] Tracking startup notice:', err);
    return false;
  }
}

export async function updateActiveTrackingJob(jobId: string | null): Promise<void> {
  activeJobId = jobId;
}

export async function stopTracking(): Promise<void> {
  activeDriverId = null;
  activeJobId = null;

  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }

  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    }
  } catch {}
  console.log('[LocationService] Tracking stopped.');
}
