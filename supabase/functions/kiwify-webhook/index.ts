// Webhook receiver for Kiwify purchase events
// Auto-activates user subscription based on product/plan purchased.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-kiwify-signature",
};

// Maps Kiwify product names/IDs to internal plans + arenas + duration (days)
const PRODUCT_MAP: Record<
  string,
  { plan: "starter" | "basic" | "base" | "premium"; arenas: string[]; days: number }
> = {
  // Match by lowercase substring — primeira chave que casa vence.
  // ⚠️ "basic" precisa vir ANTES de "base" porque "basic".includes("base") seria falso, mas
  //    queremos "basic" como match exato em vez de cair em substring genérica.
  basic:   { plan: "basic",   arenas: ["arena_punter"], days: 30 },
  starter: { plan: "starter", arenas: ["arena_live"], days: 30 },
  base:    { plan: "base",    arenas: ["arena_live", "arena_punter"], days: 30 },
  punter:  { plan: "basic",   arenas: ["arena_punter"], days: 30 },
  premium: { plan: "premium", arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"], days: 30 },
  full:    { plan: "premium", arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"], days: 30 },
};

function resolveProduct(productName: string) {
  const lower = (productName || "").toLowerCase();
  for (const key of Object.keys(PRODUCT_MAP)) {
    if (lower.includes(key)) return PRODUCT_MAP[key];
  }
  // default fallback: starter
  return PRODUCT_MAP.starter;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Optional secret check
  const expected = Deno.env.get("KIWIFY_WEBHOOK_SECRET");
  if (expected) {
    const url = new URL(req.url);
    const got = url.searchParams.get("token") || req.headers.get("x-kiwify-signature");
    if (got !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Kiwify payload field guesses (handles a few variants)
  const eventType: string = payload?.webhook_event_type || payload?.event || payload?.type || "unknown";
  const orderId: string | null =
    payload?.order_id || payload?.order?.id || payload?.id || null;
  const customerEmail: string =
    (payload?.Customer?.email || payload?.customer?.email || payload?.customer_email || payload?.email || "")
      .toLowerCase().trim();
  const productName: string =
    payload?.Product?.product_name ||
    payload?.product?.name ||
    payload?.product_name ||
    payload?.plan ||
    "";
  const amount: number = Number(payload?.Commissions?.charge_amount || payload?.amount || payload?.value || 0) || 0;

  const resolved = resolveProduct(productName);

  // Save raw event for audit
  const { data: evt } = await sb.from("purchase_events").insert({
    provider: "kiwify",
    event_type: eventType,
    external_order_id: orderId,
    customer_email: customerEmail,
    product_name: productName,
    plan_resolved: resolved.plan,
    amount,
    raw_payload: payload,
    processed: false,
  }).select("id").single();

  // Only act on approved/paid events
  const PAID_EVENTS = ["order_approved", "order.paid", "compra_aprovada", "purchase_approved", "approved", "paid"];
  const isPaid = PAID_EVENTS.some((e) => eventType.toLowerCase().includes(e.toLowerCase()));

  if (!isPaid) {
    return new Response(JSON.stringify({ ok: true, skipped: "not_paid_event", event: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!customerEmail) {
    await sb.from("purchase_events").update({ process_error: "missing_email" }).eq("id", evt?.id);
    return new Response(JSON.stringify({ ok: false, error: "missing_email" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find user by email (paginate)
  let user: any = null;
  let page = 1;
  while (page <= 20 && !user) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    user = data.users.find((u) => (u.email || "").toLowerCase() === customerEmail);
    if (data.users.length < 1000) break;
    page++;
  }

  if (!user) {
    await sb.from("purchase_events").update({ process_error: "user_not_found" }).eq("id", evt?.id);
    return new Response(JSON.stringify({ ok: false, error: "user_not_found", email: customerEmail }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + resolved.days * 86400_000);

  // Upsert subscription
  const { error: upErr } = await sb.from("user_subscriptions").upsert({
    user_id: user.id,
    plan: resolved.plan,
    is_active: true,
    subscription_started_at: startsAt.toISOString(),
    subscription_ends_at: endsAt.toISOString(),
    allowed_arenas: resolved.arenas,
    payment_provider: "kiwify",
    external_order_id: orderId,
    payment_amount: amount,
    notes: `Auto-ativado via Kiwify webhook (${productName})`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (upErr) {
    await sb.from("purchase_events").update({ process_error: upErr.message }).eq("id", evt?.id);
    return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await sb.from("purchase_events").update({ processed: true, user_id: user.id }).eq("id", evt?.id);

  return new Response(JSON.stringify({
    ok: true,
    user_id: user.id,
    email: customerEmail,
    plan: resolved.plan,
    arenas: resolved.arenas,
    expires: endsAt.toISOString(),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
