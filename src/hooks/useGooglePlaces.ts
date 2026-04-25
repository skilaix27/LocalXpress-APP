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

// ─── Script loader ────────────────────────────────────────────────────────────

const SCRIPT_ID = 'google-maps-js';
let scriptPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.google?.maps?.places) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      // Script tag exists but hasn't fired onload yet — wait for it
      const interval = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(interval); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // v=weekly exposes AutocompleteSuggestion on google.maps.places without importLibrary
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&language=es&region=ES`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error('Google Maps script failed to load')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGooglePlaces() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const readyRef = useRef(false);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey) return;
    loadScript(apiKey)
      .then(() => {
        const places = window.google?.maps?.places as Record<string, unknown> | undefined;
        if (!places?.AutocompleteSuggestion) {
          console.warn('google.maps.places.AutocompleteSuggestion not available');
          return;
        }
        readyRef.current = true;
        tokenRef.current = new google.maps.places.AutocompleteSessionToken();
      })
      .catch(console.error);
  }, [apiKey]);

  const search = useCallback(async (input: string) => {
    if (!input || input.length < 3 || !readyRef.current) {
      setPredictions([]);
      return;
    }

    const AutocompleteSuggestion = (window.google?.maps?.places as Record<string, unknown>)
      ?.AutocompleteSuggestion as typeof google.maps.places.AutocompleteSuggestion | undefined;

    if (!AutocompleteSuggestion) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: tokenRef.current ?? undefined,
        includedRegionCodes: ['es'],
        language: 'es',
      } as google.maps.places.AutocompleteRequest);

      setPredictions(
        suggestions
          .map((s) => s.placePrediction)
          .filter((pp): pp is google.maps.places.PlacePrediction => pp !== null)
          .map((pp) => ({
            placeId: pp.placeId,
            mainText: pp.mainText?.text ?? pp.text.text,
            secondaryText: pp.secondaryText?.text ?? '',
            fullText: pp.text.text,
          }))
      );
    } catch (err) {
      console.error('AutocompleteSuggestion error:', err);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    if (!readyRef.current) return null;

    const Place = (window.google?.maps?.places as Record<string, unknown>)
      ?.Place as typeof google.maps.places.Place | undefined;

    if (!Place) return null;

    setDetailsLoading(true);
    try {
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

      tokenRef.current = new google.maps.places.AutocompleteSessionToken();

      return {
        formattedAddress: place.formattedAddress ?? '',
        displayName: place.displayName ?? '',
        lat: place.location?.lat() ?? 0,
        lng: place.location?.lng() ?? 0,
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
  }, []);

  return { predictions, loading, detailsLoading, search, getDetails, clear };
}
