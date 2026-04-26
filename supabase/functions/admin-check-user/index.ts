// Admin diagnostic: check if a user exists in auth.users by email
// Returns: exists, email_confirmed, created_at, last_sign_in_at, has_profile
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // listUsers paginates; we filter manually because admin API has no email filter
    const target = email.toLowerCase().trim();
    let found: any = null;
    let page = 1;
    const perPage = 1000;
    while (page <= 20 && !found) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      found = data.users.find((u) => (u.email || "").toLowerCase() === target);
      if (data.users.length < perPage) break;
      page++;
    }

    if (!found) {
      return new Response(
        JSON.stringify({ exists: false, message: "Usuária NÃO encontrada em auth.users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // check profile
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, username, created_at")
      .eq("user_id", found.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        exists: true,
        id: found.id,
        email: found.email,
        email_confirmed_at: found.email_confirmed_at,
        confirmed_at: found.confirmed_at,
        created_at: found.created_at,
        last_sign_in_at: found.last_sign_in_at,
        providers: found.app_metadata?.providers,
        has_profile: !!profile,
        profile,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
