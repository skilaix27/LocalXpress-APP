import { useState, useCallback, useRef } from 'react';

export interface AddressSuggestion {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
}

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const fullQuery = query.toLowerCase().includes('barcelona')
          ? query
          : `${query}, Barcelona, Spain`;

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5&addressdetails=1&countrycodes=es`,
          {
            headers: { 'Accept-Language': 'es' },
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data = await res.json();
        const mapped: AddressSuggestion[] = data.map((item: any) => ({
          displayName: item.display_name,
          shortName: item.display_name.split(',').slice(0, 3).join(',').trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));

        setSuggestions(mapped);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Autocomplete error:', err);
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const clear = useCallback(() => {
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { suggestions, loading, search, clear };
}
