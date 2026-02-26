import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authenticated user with shop role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is shop or admin
    const { data: isShop } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "shop" });
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isShop && !isAdmin) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[notify-new-stop] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Servicio no disponible" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_code, shop_name, client_name, pickup_address, delivery_address } = body;

    if (!order_code || !client_name || !pickup_address || !delivery_address) {
      return new Response(JSON.stringify({ error: "Datos del pedido incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate string lengths
    if (typeof order_code !== 'string' || order_code.length > 50 ||
        typeof client_name !== 'string' || client_name.length > 200 ||
        typeof pickup_address !== 'string' || pickup_address.length > 500 ||
        typeof delivery_address !== 'string' || delivery_address.length > 500) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send simple email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LocalXpress <onboarding@resend.dev>",
        to: ["robertogarcia2772@gmail.com"],
        subject: `Nuevo pedido ${order_code} — ${shop_name || "Tienda"}`,
        html: `<p>Nueva parada solicitada por <strong>${shop_name || "una tienda"}</strong>.</p><p>Código: <strong>${order_code}</strong></p>`,
      }),
    });

    const resendBody = await emailRes.json();

    if (!emailRes.ok) {
      console.error("[notify-new-stop] Resend error:", resendBody);
      return new Response(JSON.stringify({ success: false, reason: "Error al enviar email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-new-stop] Internal error:", err);
    return new Response(JSON.stringify({ error: "Error al procesar la solicitud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
