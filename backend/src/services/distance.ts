import { config } from '../config';

const MARGIN_KM = 0.15;

interface DistanceResult {
  distance_km: number;
  adjusted_km: number;
}

export async function getDrivingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DistanceResult> {
  const apiKey = config.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured');

  const body = {
    origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
    destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
    routeModifiers: { avoidTolls: true },
  };

  const res = await fetch(
    `https://routes.googleapis.com/directions/v2:computeRoutes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Maps API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { routes?: { distanceMeters?: number }[] };

  const meters = data?.routes?.[0]?.distanceMeters;
  if (meters == null) throw new Error('No route found between the given coordinates');

  const distance_km = Math.round((meters / 1000) * 100) / 100;
  const adjusted_km = Math.round((distance_km + MARGIN_KM) * 100) / 100;

  return { distance_km, adjusted_km };
}
