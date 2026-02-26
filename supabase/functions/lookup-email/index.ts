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
    const { username } = await req.json();

    // Input validation
    if (!username || typeof username !== "string" || username.trim().length < 1 || username.length > 100) {
      return new Response(JSON.stringify({ error: "Nombre de usuario inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject if input contains suspicious patterns
    if (/[<>'";\-\-\/\*]/.test(username)) {
      return new Response(JSON.stringify({ error: "Caracteres no permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Sanitize input for ilike pattern matching - escape all special chars
    const sanitized = username.trim().replace(/[%_\\]/g, "\\$&");

    // Search by full_name (case-insensitive) - limit results
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("full_name", `${sanitized}`)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      // Generic error to prevent user enumeration
      return new Response(JSON.stringify({ error: "Credenciales inválidas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the auth email for the exact match
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profiles[0].user_id);

    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Credenciales inválidas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only return the email, nothing else
    return new Response(JSON.stringify({ email: user.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lookup-email] Internal error:", err);
    return new Response(JSON.stringify({ error: "Error al procesar la solicitud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
