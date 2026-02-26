import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidCoord(val: unknown): boolean {
  return typeof val === 'number' && isFinite(val) && val >= -90 && val <= 90;
}

function isValidLng(val: unknown): boolean {
  return typeof val === 'number' && isFinite(val) && val >= -180 && val <= 180;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo los administradores pueden crear usuarios" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, phone, role, shop_name, default_pickup_address, default_pickup_lat, default_pickup_lng } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios: email, password, full_name, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 254) {
      return new Response(JSON.stringify({ error: "Formato de email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate full_name
    if (typeof full_name !== 'string' || full_name.trim().length < 1 || full_name.length > 200) {
      return new Response(JSON.stringify({ error: "Nombre inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["admin", "driver", "shop"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rol inválido. Debe ser 'admin', 'driver' o 'shop'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional phone
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 30)) {
      return new Response(JSON.stringify({ error: "Teléfono inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional coordinates
    if (default_pickup_lat != null && !isValidCoord(default_pickup_lat)) {
      return new Response(JSON.stringify({ error: "Latitud de recogida inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (default_pickup_lng != null && !isValidLng(default_pickup_lng)) {
      return new Response(JSON.stringify({ error: "Longitud de recogida inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (authError) {
      const msg = authError.message.includes("already been registered")
        ? "Este email ya está registrado"
        : "Error al crear el usuario";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Wait briefly for the trigger to create the profile
    await new Promise((r) => setTimeout(r, 500));

    // Update profile with additional fields
    const profileUpdate: Record<string, any> = {};
    if (phone) profileUpdate.phone = phone;
    if (shop_name) profileUpdate.shop_name = shop_name;
    if (default_pickup_address) profileUpdate.default_pickup_address = default_pickup_address;
    if (default_pickup_lat != null) profileUpdate.default_pickup_lat = default_pickup_lat;
    if (default_pickup_lng != null) profileUpdate.default_pickup_lng = default_pickup_lng;

    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", userId);
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
    });

    if (roleError) {
      console.error("[create-user] Role assignment error:", roleError);
      return new Response(JSON.stringify({ error: "Usuario creado pero error al asignar rol" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email, role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-user] Internal error:", err);
    return new Response(JSON.stringify({ error: "Error al procesar la solicitud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
