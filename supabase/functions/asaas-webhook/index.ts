// Webhook Asaas — processa confirmações e estornos de pagamento.
// Suporta Day Pass (24h), assinatura mensal (30d) e novos planos (iniciante/profissional/elite).
// Idempotente via asaas_event_id UNIQUE.
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const REVOKE_EVENTS = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_OVERDUE"]);

type ArenaKey = "arena_live" | "arena_punter" | "multiplas" | "banca_virtual" | "banca_real";

/** Configuração por plano: arenas liberadas + multiplicador BC + duração padrão */
const PLAN_CONFIG: Record<string, { arenas: ArenaKey[]; bcMultiplier: number; defaultDurationHours: number }> = {
  // Day Pass e planos legados → tudo liberado
  premium: {
    arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
    bcMultiplier: 1.0,
    defaultDurationHours: 24,
  },
  // Plano Promo (R$47,90) → 2 arenas, modo simples, sem resgate BC
  base: {
    arenas: ["arena_live", "arena_punter"],
    bcMultiplier: 1.0,
    defaultDurationHours: 720,
  },
  starter: {
    arenas: ["arena_live", "arena_punter"],
    bcMultiplier: 1.0,
    defaultDurationHours: 720,
  },
  // Plano Iniciante (R$87,90) → 1 arena; allowed_arenas definido no momento da venda
  iniciante: {
    arenas: ["arena_punter"], // fallback; sobrescrito por chargeRow.allowed_arenas se presente
    bcMultiplier: 1.0,
    defaultDurationHours: 720,
  },
  // Plano Profissional (R$147,00) → 2 arenas + tudo
  profissional: {
    arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
    bcMultiplier: 1.0,
    defaultDurationHours: 720,
  },
  // Plano Elite (R$249,90) → tudo + 1.3× BC
  elite: {
    arenas: ["arena_live", "arena_punter", "multiplas", "banca_virtual", "banca_real"],
    bcMultiplier: 1.3,
    defaultDurationHours: 720,
  },
};

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
  const asaasSubscriptionId: string | null = payment?.subscription ?? null;
  const externalReference: string | null = payment?.externalReference ?? null;
  const asaasEventId: string | null = payload?.id ?? null;

  // 2) Auditoria + idempotência
  const { data: evt, error: evtErr } = await sb.from("asaas_webhook_events").insert({
    asaas_event_id: asaasEventId,
    event_type: eventType,
    asaas_charge_id: asaasChargeId,
    user_id: externalReference,
    raw_payload: payload,
  }).select("id").maybeSingle();

  if (evtErr && evtErr.code === "23505") {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Atualiza status da cobrança no DB se conhecemos
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

    // 3) Resolve user_id: externalReference > asaas_charges > day_pass_upsells
    let userId: string | null = externalReference;
    let chargeRow: any = null;
    let upsellRow: any = null;

    if (asaasChargeId) {
      const { data: row } = await sb.from("asaas_charges")
        .select("*").eq("asaas_charge_id", asaasChargeId).maybeSingle();
      chargeRow = row;
      if (!userId && row?.user_id) userId = row.user_id;
    }

    // Para renovações de subscription: charge não está em asaas_charges mas subscription_id sim
    if (!userId && asaasSubscriptionId) {
      const { data: row } = await sb.from("day_pass_upsells")
        .select("*").eq("asaas_subscription_id", asaasSubscriptionId).maybeSingle();
      upsellRow = row;
      if (row?.user_id) userId = row.user_id;
    }

    if (!userId) {
      if (evt?.id) await sb.from("asaas_webhook_events").update({ process_error: "user_not_found" }).eq("id", evt.id);
      return new Response(JSON.stringify({ ok: false, error: "user_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (PAID_EVENTS.has(eventType)) {
      // Determina duração e plano
      // Prioridade: chargeRow > upsellRow > defaults
      let planTarget: string = chargeRow?.plan_target ?? upsellRow?.plan_target ?? "premium";
      let durationHours: number = chargeRow?.duration_hours ?? (upsellRow ? 720 : 24);
      const paymentValue: number = Number(payment?.value || chargeRow?.value || payment?.netValue || 9.9);

      // Inferência de plano pelo valor caso plan_target não esteja no DB
      if (!chargeRow?.plan_target && !upsellRow?.plan_target) {
        if (paymentValue >= 240) planTarget = "elite";
        else if (paymentValue >= 140) planTarget = "profissional";
        else if (paymentValue >= 80)  planTarget = "iniciante";
        else if (paymentValue >= 40)  planTarget = "starter";
        else                          planTarget = "premium"; // day pass ou legado
      }

      const config = PLAN_CONFIG[planTarget] ?? PLAN_CONFIG["premium"];
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationHours * 3600_000);

      // allowed_arenas: usa o que foi gravado na cobrança (ex: iniciante com arena escolhida)
      // se não tiver, usa o padrão do plano
      const allowedArenas: ArenaKey[] = chargeRow?.allowed_arenas ?? config.arenas;

      const { error: upErr } = await sb.from("user_subscriptions").upsert({
        user_id: userId,
        plan: planTarget,
        is_active: true,
        subscription_started_at: startsAt.toISOString(),
        subscription_ends_at: endsAt.toISOString(),
        allowed_arenas: allowedArenas,
        bc_multiplier: config.bcMultiplier,
        payment_provider: "asaas",
        external_order_id: asaasChargeId,
        payment_amount: paymentValue,
        notes: `Plano ${planTarget} auto-ativado via Asaas (${eventType}) — ${durationHours}h`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (upErr) {
        if (evt?.id) await sb.from("asaas_webhook_events").update({ process_error: upErr.message }).eq("id", evt.id);
        return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualiza day_pass_upsells se for assinatura mensal
      if (asaasSubscriptionId) {
        await sb.from("day_pass_upsells").upsert({
          user_id: userId,
          asaas_subscription_id: asaasSubscriptionId,
          first_charge_id: chargeRow?.asaas_charge_id ?? upsellRow?.first_charge_id,
          status: "active",
          next_due_date: new Date(endsAt.getTime() + 24 * 3600_000).toISOString().slice(0, 10),
          plan_target: planTarget,
          value: paymentValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

    } else if (REVOKE_EVENTS.has(eventType)) {
      // Desativa sem apagar o plano — mantém plan para histórico mas is_active = false
      const { data: currentSub } = await sb.from("user_subscriptions")
        .select("plan").eq("user_id", userId).maybeSingle();

      await sb.from("user_subscriptions").update({
        is_active: false,
        allowed_arenas: [],
        bc_multiplier: 1.0,
        notes: `Plano suspenso via Asaas (${eventType})`,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      // Atualiza day_pass_upsells se for assinatura
      if (asaasSubscriptionId) {
        await sb.from("day_pass_upsells").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("asaas_subscription_id", asaasSubscriptionId);
      }
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
