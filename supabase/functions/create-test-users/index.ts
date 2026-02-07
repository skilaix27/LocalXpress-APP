import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "admin@rutaexpress.test", password: "Admin123!", fullName: "Carlos Admin", role: "admin" },
    { email: "driver1@rutaexpress.test", password: "Driver123!", fullName: "María Repartidora", role: "driver" },
    { email: "driver2@rutaexpress.test", password: "Driver123!", fullName: "Pedro Repartidor", role: "driver" },
  ];

  const results = [];

  for (const u of users) {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });

    if (authError) {
      results.push({ email: u.email, error: authError.message });
      continue;
    }

    const userId = authData.user.id;

    // Get profile id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    // Assign role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: u.role,
    });

    results.push({ email: u.email, role: u.role, success: true });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
