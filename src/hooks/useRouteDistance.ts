import { useState, useCallback } from 'react';
import { haversineKm } from '@/lib/api';

interface RouteResult {
  distanceKm: number;
  durationMin: number;
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
        const distanceKm = haversineKm(originLat, originLng, destLat, destLng);
        // Estimate duration: avg 20 km/h in urban traffic
        const durationMin = Math.round((distanceKm / 20) * 60);
        return { distanceKm: Math.round(distanceKm * 100) / 100, durationMin };
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { calculateDistance, loading };
}
