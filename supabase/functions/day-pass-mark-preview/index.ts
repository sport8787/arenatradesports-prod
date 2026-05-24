// Marca a subscription do usuário autenticado como 'preview' (sem acesso),
// sobrescrevendo o trial gerado pelo trigger on_auth_user_created_profile.
// Usa service role para garantir o UPDATE mesmo com RLS restritiva.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Se já é premium ativo (pagou antes), não regride.
    const { data: existing } = await sb
      .from("user_subscriptions")
      .select("plan, is_active, subscription_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.plan === "premium" && existing.is_active &&
        (!existing.subscription_ends_at || new Date(existing.subscription_ends_at) > new Date())) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_premium" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      user_id: userId,
      plan: "preview",
      is_active: false,
      trial_started_at: null,
      trial_ends_at: null,
      subscription_started_at: null,
      subscription_ends_at: null,
      allowed_arenas: [],
      notes: "Lead Day Pass - aguardando pagamento R$ 9,90",
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await sb.from("user_subscriptions").update(payload).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await sb.from("user_subscriptions").insert(payload);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, plan: "preview" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
