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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[notify-new-stop] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Servicio no disponible" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_code, shop_name, client_name, pickup_address, delivery_address, scheduled_pickup_at, distance_km } = body;

    if (!order_code || !client_name || !pickup_address || !delivery_address) {
      return new Response(JSON.stringify({ error: "Datos del pedido incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin emails from the database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const adminEmails: string[] = [];

    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    console.log("[notify-new-stop] Admin roles query:", { adminRoles, rolesError });

    if (adminRoles && adminRoles.length > 0) {
      for (const role of adminRoles) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (user?.email) adminEmails.push(user.email);
      }
    }

    console.log("[notify-new-stop] Admin emails found:", adminEmails);

    if (adminEmails.length === 0) {
      console.warn("[notify-new-stop] No admin emails from DB, cannot send notification");
      return new Response(JSON.stringify({ success: false, reason: "No se encontraron emails de admin" }), {
        status: 200,
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
    console.log("[notify-new-stop] Resend response:", { status: emailRes.status, ok: emailRes.ok, body: resendBody });

    if (!emailRes.ok) {
      console.error("[notify-new-stop] Resend error:", resendBody);
      return new Response(JSON.stringify({ success: false, reason: "Error al enviar email", details: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sent_to: adminEmails.length }), {
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
