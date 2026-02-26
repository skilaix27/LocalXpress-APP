import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('[places-autocomplete] GOOGLE_MAPS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Servicio no disponible' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { input, action, placeId } = await req.json();

    // Action: "details"
    if (action === 'details' && placeId) {
      if (typeof placeId !== 'string' || placeId.length > 300) {
        return new Response(JSON.stringify({ error: 'ID de lugar inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate placeId format (alphanumeric + underscores/hyphens only)
      if (!/^[a-zA-Z0-9_\-]+$/.test(placeId)) {
        return new Response(JSON.stringify({ error: 'ID de lugar inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
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
        return new Response(JSON.stringify({ error: 'Error al obtener detalles del lugar' }), {
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
    if (!input || typeof input !== 'string' || input.trim().length < 2 || input.length > 500) {
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
      return new Response(JSON.stringify({ error: 'Error en la búsqueda de direcciones' }), {
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
    return new Response(JSON.stringify({ error: 'Error al procesar la solicitud' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
