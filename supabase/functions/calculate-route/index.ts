import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidCoord(lat: number, lng: number): boolean {
  return typeof lat === 'number' && typeof lng === 'number' &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    isFinite(lat) && isFinite(lng);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('[calculate-route] GOOGLE_MAPS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Servicio no disponible' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { originLat, originLng, destLat, destLng } = await req.json();

    if (!isValidCoord(originLat, originLng) || !isValidCoord(destLat, destLng)) {
      return new Response(JSON.stringify({ error: 'Coordenadas inválidas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ error: 'Error al calcular la ruta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.routes?.length) {
      return new Response(JSON.stringify({ error: 'No se encontró una ruta' }), {
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
    return new Response(JSON.stringify({ error: 'Error al procesar la solicitud' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
