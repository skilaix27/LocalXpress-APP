import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface PlaceDetails {
  formattedAddress: string;
  displayName: string;
  lat: number;
  lng: number;
}

export function useGooglePlaces() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!input || input.trim().length < 2) {
      setPredictions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('places-autocomplete', {
          body: { input, action: 'autocomplete' },
        });

        if (error) {
          console.error('Places autocomplete error:', error);
          setPredictions([]);
          return;
        }

        setPredictions(data?.predictions || []);
      } catch (err) {
        console.error('Places autocomplete error:', err);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    setDetailsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('places-autocomplete', {
        body: { action: 'details', placeId },
      });

      if (error || !data?.lat) {
        console.error('Place details error:', error || data);
        return null;
      }

      return {
        formattedAddress: data.formattedAddress,
        displayName: data.displayName,
        lat: data.lat,
        lng: data.lng,
      };
    } catch (err) {
      console.error('Place details error:', err);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { predictions, loading, detailsLoading, search, getDetails, clear };
}
