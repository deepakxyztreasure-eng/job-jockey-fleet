// Google Maps, Places & Routes Service for Jodha Driver App
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCAPYcCyZfs_3qpFv09bcU3VRRdoEwAIek';

export interface ETAResult {
  durationText: string;      // e.g. "28 mins"
  distanceText: string;      // e.g. "19.4 km"
  durationSeconds: number;
  distanceMeters: number;
  estimatedArrival: string;  // e.g. "3:15 PM"
  encodedPolyline?: string;
}

/**
 * Calculates live turn-by-turn driving ETA and distance using Google Routes API v2
 */
export async function calculateDrivingETA(
  originLat: number,
  originLng: number,
  destination: string
): Promise<ETAResult | null> {
  if (!originLat || !originLng || !destination) return null;

  try {
    // 1. Google Routes API (New v2)
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: originLat,
              longitude: originLng,
            },
          },
        },
        destination: {
          address: destination,
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const durationSec = parseInt((route.duration || '0s').replace('s', ''), 10) || 60;
        const distMeters = route.distanceMeters || 0;

        const arrivalDate = new Date(Date.now() + durationSec * 1000);
        const estimatedArrival = arrivalDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const durationText =
          durationSec >= 3600
            ? `${Math.floor(durationSec / 3600)}h ${Math.round((durationSec % 3600) / 60)}m`
            : `${Math.max(1, Math.round(durationSec / 60))} mins`;

        const distanceText =
          distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(1)} km`
            : `${distMeters} m`;

        return {
          durationText,
          distanceText,
          durationSeconds: durationSec,
          distanceMeters: distMeters,
          estimatedArrival,
          encodedPolyline: route.polyline?.encodedPolyline,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Error calculating driving ETA with Routes API:', err);
    return null;
  }
}

/**
 * Translates raw GPS coordinate pings into human-readable quarry or street addresses
 */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results && data.results[0]) {
      return data.results[0].formatted_address;
    }
    return null;
  } catch (err) {
    console.warn('Error reverse geocoding:', err);
    return null;
  }
}

/**
 * Address autocomplete suggestions for search / job destination queries
 */
export async function getPlaceAutocomplete(input: string): Promise<Array<{ description: string; placeId: string }>> {
  if (!input || input.trim().length < 3) return [];

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:au&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.predictions) {
      return data.predictions.map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Error getting place autocomplete:', err);
    return [];
  }
}
