// Google Maps, Places & Routes Service for Jodha Driver App
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCAPYcCyZfs_3qpFv09bcU3VRRdoEwAIek';

export interface ETAResult {
  durationText: string;      // e.g. "28 mins"
  distanceText: string;      // e.g. "19.4 km"
  durationSeconds: number;
  distanceMeters: number;
  estimatedArrival: string;  // e.g. "3:15 PM"
}

/**
 * Calculates live turn-by-turn driving ETA and distance from driver GPS to delivery destination
 */
export async function calculateDrivingETA(
  originLat: number,
  originLng: number,
  destination: string
): Promise<ETAResult | null> {
  if (!originLat || !originLng || !destination) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${encodeURIComponent(destination)}&mode=driving&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.routes && data.routes[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0];
      const durationSec = leg.duration_in_traffic
        ? leg.duration_in_traffic.value
        : leg.duration.value;

      const arrivalDate = new Date(Date.now() + durationSec * 1000);
      const estimatedArrival = arrivalDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        durationText: leg.duration_in_traffic?.text || leg.duration.text,
        distanceText: leg.distance.text,
        durationSeconds: durationSec,
        distanceMeters: leg.distance.value,
        estimatedArrival,
      };
    } else {
      console.warn('Google Directions API response status:', data.status, data.error_message);
      return null;
    }
  } catch (err) {
    console.warn('Error calculating driving ETA:', err);
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
