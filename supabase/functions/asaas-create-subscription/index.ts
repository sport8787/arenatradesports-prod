// Cria assinatura mensal R$ 47/mês (Pix) na Asaas para o usuário autenticado.
// Retorna invoiceUrl + Pix QR Code da PRIMEIRA cobrança.
// Reusa cliente Asaas existente (asaas_charges.asaas_customer_id) se houver.
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase();
const ASAAS_BASE = ASAAS_ENV === "sandbox"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";
const SUB_VALUE = 47.00;
const SUB_DESCRIPTION = "Oráculo Mycroft — Assinatura Mensal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_asaas_api_key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
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
    const user = userData.user;

    // Se já tem assinatura ativa/pendente, devolve dados existentes
    const { data: existing } = await sb
      .from("day_pass_upsells")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && existing.status === "active") {
      return new Response(JSON.stringify({
        already_active: true,
        subscription_id: existing.asaas_subscription_id,
        next_due_date: existing.next_due_date,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }
    const cpfCnpj: string | undefined = (body?.cpfCnpj || "").replace(/\D/g, "") || undefined;
    const triggerSource: string = body?.triggerSource || "unknown"; // green | 4h | 1h
    const name: string =
      user.user_metadata?.full_name ||
      user.user_metadata?.username ||
      (user.email || "Cliente Mycroft").split("@")[0];

    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return new Response(JSON.stringify({ error: "invalid_cpf" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se assinatura PENDING existe, tenta reutilizar e devolver cobrança atual
    if (existing && existing.asaas_subscription_id && existing.status === "pending") {
      const payListRes = await fetch(
        `${ASAAS_BASE}/subscriptions/${existing.asaas_subscription_id}/payments?limit=1`,
        { headers: { access_token: apiKey } },
      );
      const payList = await payListRes.json();
      const firstPay = payList?.data?.[0];
      if (firstPay?.id) {
        const qrRes = await fetch(`${ASAAS_BASE}/payments/${firstPay.id}/pixQrCode`, {
          headers: { access_token: apiKey },
        });
        const qrJson = await qrRes.json();
        return new Response(JSON.stringify({
          subscription_id: existing.asaas_subscription_id,
          charge_id: firstPay.id,
          invoice_url: firstPay.invoiceUrl,
          pix_qr_code: qrJson?.encodedImage ? `data:image/png;base64,${qrJson.encodedImage}` : null,
          pix_payload: qrJson?.payload ?? null,
          value: SUB_VALUE,
          reused: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 1) Cria/recupera customer (reusa do asaas_charges)
    let customerId: string | null = null;
    const { data: prevCharge } = await sb
      .from("asaas_charges")
      .select("asaas_customer_id")
      .eq("user_id", user.id)
      .not("asaas_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (prevCharge?.asaas_customer_id) {
      customerId = prevCharge.asaas_customer_id;
    } else {
      const custRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          name, email: user.email, cpfCnpj, externalReference: user.id,
        }),
      });
      const custJson = await custRes.json();
      if (!custRes.ok || !custJson?.id) {
        await logEdgeError("asaas-create-subscription", new Error("customer_create_failed"), { context: { res: custJson }, statusCode: custRes.status });
        return new Response(JSON.stringify({ error: "customer_create_failed", details: custJson }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = custJson.id;
    }

    // 2) Cria subscription (Pix mensal, primeira cobrança vence amanhã)
    const nextDueDate = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: SUB_VALUE,
        nextDueDate,
        cycle: "MONTHLY",
        description: SUB_DESCRIPTION,
        externalReference: user.id,
      }),
    });
    const subJson = await subRes.json();
    if (!subRes.ok || !subJson?.id) {
      await logEdgeError("asaas-create-subscription", new Error("subscription_create_failed"), { context: { res: subJson }, statusCode: subRes.status });
      return new Response(JSON.stringify({ error: "subscription_create_failed", details: subJson }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const subscriptionId: string = subJson.id;

    // 3) Busca a primeira cobrança gerada pela assinatura
    let firstChargeId: string | null = null;
    let invoiceUrl: string | null = null;
    let pixQrCode: string | null = null;
    let pixPayload: string | null = null;

    // pequenas tentativas (Asaas gera de forma assíncrona)
    for (let attempt = 0; attempt < 4; attempt++) {
      const payListRes = await fetch(
        `${ASAAS_BASE}/subscriptions/${subscriptionId}/payments?limit=1`,
        { headers: { access_token: apiKey } },
      );
      const payList = await payListRes.json();
      const firstPay = payList?.data?.[0];
      if (firstPay?.id) {
        firstChargeId = firstPay.id;
        invoiceUrl = firstPay.invoiceUrl;
        const qrRes = await fetch(`${ASAAS_BASE}/payments/${firstChargeId}/pixQrCode`, {
          headers: { access_token: apiKey },
        });
        const qrJson = await qrRes.json();
        pixQrCode = qrJson?.encodedImage ? `data:image/png;base64,${qrJson.encodedImage}` : null;
        pixPayload = qrJson?.payload ?? null;
        break;
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    // 4) Persiste estado da assinatura
    await sb.from("day_pass_upsells").upsert({
      user_id: user.id,
      asaas_subscription_id: subscriptionId,
      status: "pending",
      first_charge_id: firstChargeId,
      next_due_date: nextDueDate,
      value: SUB_VALUE,
      trigger_source: triggerSource,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Também grava em asaas_charges (para webhook unificado)
    if (firstChargeId) {
      await sb.from("asaas_charges").upsert({
        user_id: user.id,
        asaas_charge_id: firstChargeId,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        status: "PENDING",
        billing_type: "PIX",
        value: SUB_VALUE,
        description: SUB_DESCRIPTION,
        invoice_url: invoiceUrl,
        pix_qr_code: pixQrCode,
        pix_payload: pixPayload,
        product_slug: "subscription_monthly",
        plan_target: "premium",
        duration_hours: 720, // 30 dias
        environment: ASAAS_ENV,
      }, { onConflict: "asaas_charge_id" });
    }

    return new Response(JSON.stringify({
      subscription_id: subscriptionId,
      charge_id: firstChargeId,
      invoice_url: invoiceUrl,
      pix_qr_code: pixQrCode,
      pix_payload: pixPayload,
      value: SUB_VALUE,
      reused: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    await logEdgeError("asaas-create-subscription", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
