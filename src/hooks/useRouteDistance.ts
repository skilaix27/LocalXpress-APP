import { useState, useCallback } from 'react';
import { haversineKm } from '@/lib/api';

interface RouteResult {
  distanceKm: number;
  durationMin: number;
}

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

async function fetchRouteDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) throw new Error('No Google Maps API key');

  const res = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      routeModifiers: { avoidTolls: true },
      languageCode: 'es-ES',
      units: 'METRIC',
    }),
  });

  if (!res.ok) throw new Error(`Routes API error: ${res.status}`);

  const data = await res.json() as { routes?: { distanceMeters?: number; duration?: string }[] };
  const route = data.routes?.[0];
  if (!route?.distanceMeters) throw new Error('No route returned');

  const distanceKm = Number((route.distanceMeters / 1000 + 0.3).toFixed(2));
  const durationSec = route.duration ? parseInt(route.duration.replace('s', ''), 10) : 0;
  const durationMin = Math.round(durationSec / 60);

  return { distanceKm, durationMin };
}

export function useRouteDistance() {
  const [loading, setLoading] = useState(false);

  const calculateDistance = useCallback(
    async (
      originLat: number,
      originLng: number,
      destLat: number,
      destLng: number
    ): Promise<RouteResult | null> => {
      setLoading(true);
      try {
        return await fetchRouteDistance(originLat, originLng, destLat, destLng);
      } catch (err) {
        console.warn('Google Routes API failed, falling back to Haversine:', err);
        try {
          const distanceKm = Number((haversineKm(originLat, originLng, destLat, destLng) + 0.3).toFixed(2));
          const durationMin = Math.round((distanceKm / 20) * 60);
          return { distanceKm, durationMin };
        } catch {
          return null;
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { calculateDistance, loading };
}
