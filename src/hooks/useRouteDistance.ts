import { useState, useCallback } from 'react';

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
        // OSRM expects lng,lat order
        const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) return null;

        const route = data.routes[0];
        return {
          distanceKm: Math.round((route.distance / 1000) * 100) / 100,
          durationMin: Math.round(route.duration / 60),
        };
      } catch (err) {
        console.error('OSRM routing error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { calculateDistance, loading };
}
