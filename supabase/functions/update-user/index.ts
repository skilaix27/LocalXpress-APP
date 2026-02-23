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

    // Verify caller is admin
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
      return new Response(JSON.stringify({ error: "Solo los administradores pueden editar usuarios" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { profile_id, full_name, phone, password, is_active } = body;

    if (!profile_id) {
      return new Response(JSON.stringify({ error: "Se requiere profile_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user_id from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile fields
    const profileUpdates: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (phone !== undefined) profileUpdates.phone = phone || null;
    if (is_active !== undefined) profileUpdates.is_active = is_active;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", profile_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: `Error al actualizar perfil: ${updateError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update password if provided
    if (password && password.length > 0) {
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password }
      );

      if (authError) {
        return new Response(JSON.stringify({ error: `Error al cambiar contraseña: ${authError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
