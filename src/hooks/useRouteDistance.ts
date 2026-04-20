import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
        const { data, error } = await supabase.functions.invoke('calculate-route', {
          body: { originLat, originLng, destLat, destLng },
        });

        if (error) {
          console.error('Route calculation error:', error);
          return null;
        }

        if (data?.error) {
          console.error('Google Maps API error:', data.error, data.message);
          return null;
        }

        return {
          distanceKm: data.distanceKm,
          durationMin: data.durationMin,
        };
      } catch (err) {
        console.error('Route calculation error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { calculateDistance, loading };
}
