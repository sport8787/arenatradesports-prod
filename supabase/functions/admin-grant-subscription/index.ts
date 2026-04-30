// Admin-only: manually grant/edit a user's subscription.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_ARENAS: Record<string, string[]> = {
  trial:   ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
  starter: ["arena_live"],
  base:    ["arena_live", "arena_punter"],
  premium: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller is admin
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: uerr } = await userClient.auth.getUser();
    if (uerr || !u.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, plan, ends_at, arenas, notes, payment_provider, external_order_id, amount } = body;

    if (!email || !plan) {
      return new Response(JSON.stringify({ error: "missing_email_or_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["trial", "starter", "base", "premium"].includes(plan)) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user
    const target = String(email).toLowerCase().trim();
    let found: any = null;
    let page = 1;
    while (page <= 20 && !found) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      found = data.users.find((x) => (x.email || "").toLowerCase() === target);
      if (data.users.length < 1000) break;
      page++;
    }
    if (!found) {
      return new Response(JSON.stringify({ error: "user_not_found", email: target }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalArenas = Array.isArray(arenas) && arenas.length ? arenas : (PLAN_ARENAS[plan] || []);
    const endsAt = ends_at ? new Date(ends_at).toISOString() : new Date(Date.now() + 30 * 86400_000).toISOString();

    const { error: upErr } = await admin.from("user_subscriptions").upsert({
      user_id: found.id,
      plan,
      is_active: true,
      subscription_started_at: new Date().toISOString(),
      subscription_ends_at: endsAt,
      allowed_arenas: finalArenas,
      payment_provider: payment_provider || "manual",
      external_order_id: external_order_id || null,
      payment_amount: amount ?? null,
      notes: notes || `Ativação manual por admin ${u.user.email}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true, user_id: found.id, email: target, plan, arenas: finalArenas, expires: endsAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
