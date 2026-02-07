import { useState, useCallback } from 'react';

interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

export function useGeocoding() {
  const [loading, setLoading] = useState(false);

  const geocodeAddress = useCallback(async (address: string): Promise<GeocodingResult | null> => {
    if (!address.trim()) return null;
    
    setLoading(true);
    try {
      // Add "Barcelona, Spain" context for better results
      const query = address.toLowerCase().includes('barcelona') 
        ? address 
        : `${address}, Barcelona, Spain`;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.length === 0) return null;
      
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { geocodeAddress, loading };
}
