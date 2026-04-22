import { useState, useCallback } from 'react';

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

// Address autocomplete is not available in the custom backend.
// The AddressInput component falls back to manual text entry.
export function useGooglePlaces() {
  const [predictions] = useState<PlacePrediction[]>([]);
  const [loading] = useState(false);
  const [detailsLoading] = useState(false);

  const search = useCallback((_input: string) => {
    // No-op: autocomplete not available
  }, []);

  const getDetails = useCallback(async (_placeId: string): Promise<PlaceDetails | null> => {
    return null;
  }, []);

  const clear = useCallback(() => {}, []);

  return { predictions, loading, detailsLoading, search, getDetails, clear };
}
