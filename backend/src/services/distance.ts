import { config } from '../config';

const MARGIN_KM = 0.15;

// ─── Geocoding (Maps Geocoding API) ──────────────────────────────────────────

export type GeocodeResult =
  | { ok: true;  lat: number; lng: number; formatted_address: string; google_status: string }
  | { ok: false; google_status: string; error_message: string };

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = config.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, google_status: 'NO_API_KEY', error_message: 'GOOGLE_MAPS_API_KEY no configurada en el servidor' };
  }

  console.log(`[geocode] Trying: ${address}`);

  let httpRes: Response;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address)}` +
      `&region=es` +
      `&components=country:ES` +
      `&key=${apiKey}`;
    httpRes = await fetch(url);
  } catch (err) {
    const msg = `Fetch error: ${String(err)}`;
    console.error(`[geocode] FAILED fetch "${address}": ${msg}`);
    return { ok: false, google_status: 'FETCH_ERROR', error_message: msg };
  }

  if (!httpRes.ok) {
    const msg = `HTTP ${httpRes.status} ${httpRes.statusText}`;
    console.error(`[geocode] FAILED HTTP "${address}": ${msg}`);
    return { ok: false, google_status: 'HTTP_ERROR', error_message: msg };
  }

  let data: {
    status: string;
    error_message?: string;
    results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[];
  };

  try {
    data = await httpRes.json();
  } catch (err) {
    const msg = `JSON parse error: ${String(err)}`;
    console.error(`[geocode] FAILED parse "${address}": ${msg}`);
    return { ok: false, google_status: 'PARSE_ERROR', error_message: msg };
  }

  if (data.status !== 'OK') {
    const msg = data.error_message ?? `No results (status=${data.status})`;
    console.warn(`[geocode] FAILED status=${data.status} "${address}": ${msg}`);
    return { ok: false, google_status: data.status, error_message: msg };
  }

  const loc = data.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    const msg = 'OK status but geometry.location missing';
    console.error(`[geocode] FAILED "${address}": ${msg}`);
    return { ok: false, google_status: 'INVALID_RESPONSE', error_message: msg };
  }

  const formatted = data.results![0]?.formatted_address ?? address;
  console.log(`[geocode] OK "${address}" → ${loc.lat},${loc.lng} (${formatted})`);
  return { ok: true, lat: loc.lat, lng: loc.lng, formatted_address: formatted, google_status: 'OK' };
}

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
