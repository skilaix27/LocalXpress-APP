import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('API_SECRET_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Validate required fields
    const required = ['pickup_address', 'pickup_lat', 'pickup_lng', 'delivery_address', 'delivery_lat', 'delivery_lng', 'client_name'];
    const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate coordinates
    const coords = { pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, delivery_lat: body.delivery_lat, delivery_lng: body.delivery_lng };
    for (const [key, val] of Object.entries(coords)) {
      if (typeof val !== 'number' || isNaN(val)) {
        return new Response(JSON.stringify({ error: `Invalid coordinate: ${key} must be a number` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate order code
    const now = new Date();
    const monthLetters = ['E', 'F', 'M', 'A', 'Y', 'J', 'L', 'G', 'S', 'O', 'N', 'D'];
    const dayCode = now.getDate() + 27;
    const monthLetter = monthLetters[now.getMonth()];

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Count today's stops for order number
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const { count } = await supabase
      .from('stops')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    const orderNumber = ((count ?? 0) + 1) * 5;
    const orderCode = body.order_code || `LX-D${dayCode}${monthLetter}-P${orderNumber}`;

    const { data, error } = await supabase.from('stops').insert({
      order_code: orderCode,
      pickup_address: String(body.pickup_address).slice(0, 500),
      pickup_lat: body.pickup_lat,
      pickup_lng: body.pickup_lng,
      delivery_address: String(body.delivery_address).slice(0, 500),
      delivery_lat: body.delivery_lat,
      delivery_lng: body.delivery_lng,
      client_name: String(body.client_name).slice(0, 200),
      client_phone: body.client_phone ? String(body.client_phone).slice(0, 30) : null,
      client_notes: body.client_notes ? String(body.client_notes).slice(0, 1000) : null,
      distance_km: typeof body.distance_km === 'number' ? body.distance_km : null,
      status: 'pending',
    }).select().single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create stop', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, stop: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
