import { useState, useCallback, useEffect, useRef } from 'react';

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

const SCRIPT_ID = 'google-maps-js';
let scriptPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.google?.maps?.places) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=ES&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function useGooglePlaces() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const svcRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey) return;
    loadScript(apiKey)
      .then(() => {
        svcRef.current = new google.maps.places.AutocompleteService();
        tokenRef.current = new google.maps.places.AutocompleteSessionToken();
      })
      .catch(console.error);
  }, [apiKey]);

  const search = useCallback((input: string) => {
    if (!input || input.length < 3 || !svcRef.current) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    svcRef.current.getPlacePredictions(
      {
        input,
        sessionToken: tokenRef.current ?? undefined,
        componentRestrictions: { country: 'es' },
      },
      (results, status) => {
        setLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(
            results.map((r) => ({
              placeId: r.place_id,
              mainText: r.structured_formatting.main_text,
              secondaryText: r.structured_formatting.secondary_text ?? '',
              fullText: r.description,
            }))
          );
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    if (!window.google?.maps?.places) return null;
    setDetailsLoading(true);
    if (!mapElRef.current) {
      mapElRef.current = document.createElement('div');
    }
    return new Promise((resolve) => {
      const svc = new google.maps.places.PlacesService(mapElRef.current!);
      svc.getDetails(
        {
          placeId,
          fields: ['formatted_address', 'geometry', 'name'],
          sessionToken: tokenRef.current ?? undefined,
        },
        (place, status) => {
          setDetailsLoading(false);
          tokenRef.current = new google.maps.places.AutocompleteSessionToken();
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            resolve({
              formattedAddress: place.formatted_address ?? '',
              displayName: place.name ?? '',
              lat: place.geometry?.location?.lat() ?? 0,
              lng: place.geometry?.location?.lng() ?? 0,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
  }, []);

  return { predictions, loading, detailsLoading, search, getDetails, clear };
}
