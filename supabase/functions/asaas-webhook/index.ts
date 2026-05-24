// Webhook Asaas — libera Day Pass (premium 24h) ao confirmar Pix R$ 9,90.
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const REVOKE_EVENTS = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) Valida token (header asaas-access-token configurado no painel Asaas)
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (expectedToken) {
    const got = req.headers.get("asaas-access-token") || new URL(req.url).searchParams.get("token");
    if (got !== expectedToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any = null;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType: string = (payload?.event || "").toString();
  const payment = payload?.payment || {};
  const asaasChargeId: string | null = payment?.id ?? null;
  const externalReference: string | null = payment?.externalReference ?? null;
  const asaasEventId: string | null = payload?.id ?? null;

  // 2) Auditoria + idempotência (asaas_event_id é UNIQUE)
  const { data: evt, error: evtErr } = await sb.from("asaas_webhook_events").insert({
    asaas_event_id: asaasEventId,
    event_type: eventType,
    asaas_charge_id: asaasChargeId,
    user_id: externalReference,
    raw_payload: payload,
  }).select("id").maybeSingle();

  // se duplicate (asaas_event_id existente), retorna ok para não reentregar
  if (evtErr && evtErr.code === "23505") {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Sempre atualiza status da cobrança no DB se conhecemos
    if (asaasChargeId) {
      await sb.from("asaas_charges")
        .update({
          status: payment?.status || eventType,
          paid_at: PAID_EVENTS.has(eventType) ? new Date().toISOString() : null,
        })
        .eq("asaas_charge_id", asaasChargeId);
    }

    if (!PAID_EVENTS.has(eventType) && !REVOKE_EVENTS.has(eventType)) {
      if (evt?.id) await sb.from("asaas_webhook_events").update({ processed: true }).eq("id", evt.id);
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user_id: prioriza externalReference, fallback via asaas_charges
    let userId: string | null = externalReference;
    let chargeRow: any = null;
    if (asaasChargeId) {
      const { data: row } = await sb.from("asaas_charges")
        .select("*").eq("asaas_charge_id", asaasChargeId).maybeSingle();
      chargeRow = row;
      if (!userId && row?.user_id) userId = row.user_id;
    }

    if (!userId) {
      if (evt?.id) await sb.from("asaas_webhook_events").update({ process_error: "user_not_found" }).eq("id", evt.id);
      return new Response(JSON.stringify({ ok: false, error: "user_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (PAID_EVENTS.has(eventType)) {
      const durationHours = chargeRow?.duration_hours ?? 24;
      const planTarget = chargeRow?.plan_target ?? "premium";
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationHours * 3600_000);

      const { error: upErr } = await sb.from("user_subscriptions").upsert({
        user_id: userId,
        plan: planTarget,
        is_active: true,
        subscription_started_at: startsAt.toISOString(),
        subscription_ends_at: endsAt.toISOString(),
        allowed_arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
        payment_provider: "asaas",
        external_order_id: asaasChargeId,
        payment_amount: Number(payment?.value || chargeRow?.value || 9.9),
        notes: `Day Pass 24h auto-ativado via Asaas (${eventType})`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (upErr) {
        if (evt?.id) await sb.from("asaas_webhook_events").update({ process_error: upErr.message }).eq("id", evt.id);
        return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (REVOKE_EVENTS.has(eventType)) {
      await sb.from("user_subscriptions").update({
        is_active: false,
        plan: "preview",
        allowed_arenas: [],
        notes: `Day Pass revogado via Asaas (${eventType})`,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }

    if (evt?.id) await sb.from("asaas_webhook_events").update({ processed: true }).eq("id", evt.id);

    return new Response(JSON.stringify({ ok: true, user_id: userId, event: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (evt?.id) await sb.from("asaas_webhook_events").update({ process_error: (err as Error).message }).eq("id", evt.id);
    await logEdgeError("asaas-webhook", err, { context: { eventType, asaasChargeId } });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
