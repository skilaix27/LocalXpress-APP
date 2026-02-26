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

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      console.error("[notify-new-stop] No admin users found");
      return new Response(JSON.stringify({ success: false, reason: "No hay administradores" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin emails
    const adminEmails: string[] = [];
    for (const role of adminRoles) {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
      if (user?.email) adminEmails.push(user.email);
    }

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ success: false, reason: "No se encontraron emails de admin" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format scheduled time
    let scheduledTime = "";
    if (scheduled_pickup_at) {
      const d = new Date(scheduled_pickup_at);
      scheduledTime = d.toLocaleString("es-ES", { 
        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" 
      });
    }

    const distanceText = distance_km ? `${distance_km} km` : "No calculada";

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LocalXpress <onboarding@resend.dev>",
        to: adminEmails,
        subject: `🆕 Nuevo pedido ${order_code} — ${shop_name || "Tienda"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 24px;">
              <h1 style="margin: 0 0 8px 0; font-size: 22px;">📦 Nuevo Pedido</h1>
              <p style="margin: 0; font-size: 28px; font-weight: bold;">${order_code}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tienda</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${shop_name || "—"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Cliente</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${client_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">⏰ Recogida</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${scheduledTime || "Sin programar"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📏 Distancia</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${distanceText}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #92400e;">📍 Recogida</p>
              <p style="margin: 0; font-size: 14px; color: #78350f;">${pickup_address}</p>
            </div>
            
            <div style="background: #d1fae5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #065f46;">🏠 Entrega</p>
              <p style="margin: 0; font-size: 14px; color: #064e3b;">${delivery_address}</p>
            </div>
            
            <div style="text-align: center;">
              <p style="color: #94a3b8; font-size: 13px;">Entra al panel de admin para asignar un repartidor.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json();
      console.error("[notify-new-stop] Resend error:", errorData);
      return new Response(JSON.stringify({ success: false, reason: "Error al enviar email" }), {
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
