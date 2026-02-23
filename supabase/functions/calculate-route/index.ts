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

    const { originLat, originLng, destLat, destLng } = await req.json();

    if (!originLat || !originLng || !destLat || !destLng) {
      throw new Error('Missing required coordinates');
    }

    // Use the new Routes API
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: originLat, longitude: originLng } },
        },
        destination: {
          location: { latLng: { latitude: destLat, longitude: destLng } },
        },
        travelMode: 'DRIVE',
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error('Routes API error:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: data.error?.message || 'Routes API error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.routes?.length) {
      return new Response(JSON.stringify({ error: 'No route found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const route = data.routes[0];
    const distanceKm = Math.round((route.distanceMeters / 1000) * 100) / 100;
    const durationSec = parseInt(route.duration.replace('s', ''), 10);
    const durationMin = Math.round(durationSec / 60);

    return new Response(JSON.stringify({ distanceKm, durationMin }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Route calculation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
