import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const MONTH_LETTERS = ["E", "F", "M", "A", "Y", "J", "L", "G", "S", "O", "N", "D"];

const OrderSchema = z.object({
  client_name: z.string().min(1).max(255),
  client_phone: z.string().max(50).optional().nullable(),
  client_notes: z.string().max(2000).optional().nullable(),
  pickup_address: z.string().min(1).max(500),
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  delivery_address: z.string().min(1).max(500),
  delivery_lat: z.number().min(-90).max(90),
  delivery_lng: z.number().min(-180).max(180),
  shop_name: z.string().max(255).optional().nullable(),
  shop_id: z.string().uuid().optional().nullable(),
  driver_id: z.string().uuid().optional().nullable(),
  package_size: z.enum(["small", "medium", "large"]).optional().nullable(),
  scheduled_pickup_at: z.string().datetime().optional().nullable(),
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < ab.length; i++) {
    result |= ab[i] ^ bb[i];
  }
  return result === 0;
}

async function generateOrderCode(supabase: any): Promise<string> {
  const now = new Date();
  const dayCode = now.getDate() + 27;
  const monthLetter = MONTH_LETTERS[now.getMonth()];
  const prefix = `LX-D${dayCode}${monthLetter}-P`;

  const { data: matchingStops } = await supabase
    .from("stops")
    .select("order_code")
    .like("order_code", `${prefix}%`);

  let maxP = 0;
  if (matchingStops) {
    for (const s of matchingStops) {
      const match = s.order_code?.match(/-P(\d+)$/);
      if (match) maxP = Math.max(maxP, parseInt(match[1], 10));
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomIncrement = Math.floor(Math.random() * 3) + 1;
    const orderNumber = maxP < 65 ? 65 + randomIncrement + attempt : maxP + randomIncrement + attempt;
    const code = `${prefix}${orderNumber}`;

    const { count } = await supabase
      .from("stops")
      .select("id", { count: "exact", head: true })
      .eq("order_code", code);

    if (count === 0) return code;
    maxP = orderNumber;
  }

  return `${prefix}${maxP + Math.floor(Math.random() * 10) + 5}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("API_SECRET_KEY");
  if (!apiKey || !expectedKey || !timingSafeEqual(apiKey, expectedKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = OrderSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderCode = await generateOrderCode(supabase);
    const data = parsed.data;

    // Calculate pricing from zones
    let price: number | null = null;
    let priceDriver: number | null = null;
    let priceCompany: number | null = null;

    // Fetch pricing zones
    const { data: zones } = await supabase
      .from("pricing_zones")
      .select("*")
      .order("sort_order", { ascending: true });

    if (zones && zones.length > 0) {
      // Simple haversine for distance estimate (edge function doesn't have Google Routes)
      const R = 6371;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(data.delivery_lat - data.pickup_lat);
      const dLon = toRad(data.delivery_lng - data.pickup_lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(data.pickup_lat)) * Math.cos(toRad(data.delivery_lat)) * Math.sin(dLon / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) + 0.15;

      for (const zone of zones) {
        const maxKm = zone.max_km ?? Infinity;
        if (distKm >= zone.min_km && (distKm < maxKm || zone.max_km === null)) {
          price = zone.fixed_price ? Number(zone.fixed_price) : 0;
          if (zone.per_km_price && zone.max_km === null) {
            price += Math.max(0, distKm - zone.min_km) * Number(zone.per_km_price);
          }
          price = Math.round(price * 100) / 100;
          priceDriver = Math.round(price * 0.7 * 100) / 100;
          priceCompany = Math.round(price * 0.3 * 100) / 100;
          break;
        }
      }
    }

    const { data: stop, error } = await supabase
      .from("stops")
      .insert({
        order_code: orderCode,
        client_name: data.client_name,
        client_phone: data.client_phone || null,
        client_notes: data.client_notes || null,
        pickup_address: data.pickup_address,
        pickup_lat: data.pickup_lat,
        pickup_lng: data.pickup_lng,
        delivery_address: data.delivery_address,
        delivery_lat: data.delivery_lat,
        delivery_lng: data.delivery_lng,
        shop_name: data.shop_name || null,
        shop_id: data.shop_id || null,
        driver_id: data.driver_id || null,
        package_size: data.package_size || null,
        scheduled_pickup_at: data.scheduled_pickup_at || null,
        status: "pending",
        price,
        price_driver: priceDriver,
        price_company: priceCompany,
      })
      .select("id, order_code, status, created_at, price, price_driver, price_company")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to create order", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, order: stop }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
