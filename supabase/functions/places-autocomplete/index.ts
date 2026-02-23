import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const { input, action, placeId } = await req.json();

    // Action: "autocomplete" or "details"
    if (action === 'details' && placeId) {
      // Place Details to get precise coordinates
      const url = `https://places.googleapis.com/v1/places/${placeId}`;
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'displayName,formattedAddress,location,addressComponents',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Places Details error:', JSON.stringify(data));
        return new Response(JSON.stringify({ error: data.error?.message || 'Places API error' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        formattedAddress: data.formattedAddress,
        displayName: data.displayName?.text,
        lat: data.location?.latitude,
        lng: data.location?.longitude,
        addressComponents: data.addressComponents,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: Autocomplete
    if (!input || input.trim().length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = 'https://places.googleapis.com/v1/places:autocomplete';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify({
        input,
        languageCode: 'es',
        includedRegionCodes: ['ES'],
        locationBias: {
          circle: {
            center: { latitude: 41.3851, longitude: 2.1734 },
            radius: 30000.0,
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Places Autocomplete error:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: data.error?.message || 'Places API error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const predictions = (data.suggestions || [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        mainText: s.placePrediction.structuredFormat?.mainText?.text || '',
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
        fullText: s.placePrediction.text?.text || '',
      }));

    return new Response(JSON.stringify({ predictions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Places proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
