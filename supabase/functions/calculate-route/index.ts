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

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      console.error('Google Maps API error:', data.status, data.error_message);
      return new Response(JSON.stringify({ error: data.status, message: data.error_message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leg = data.routes[0].legs[0];
    const distanceKm = Math.round((leg.distance.value / 1000) * 100) / 100;
    const durationMin = Math.round(leg.duration.value / 60);

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
