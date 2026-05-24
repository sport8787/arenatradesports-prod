// Cria cobrança Pix R$ 9,90 (Day Pass 24h) na Asaas para o usuário autenticado.
// Retorna invoiceUrl + Pix QR Code (encodedImage + payload).
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE = "https://sandbox.asaas.com/api/v3";
const DAY_PASS_VALUE = 9.90;
const DAY_PASS_DESCRIPTION = "Day Pass 24h - Oráculo Mycroft";

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

    // Reutiliza cobrança PENDING existente, se houver (evita duplicar)
    const { data: existing } = await sb
      .from("asaas_charges")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.invoice_url && existing.pix_payload) {
      return new Response(JSON.stringify({
        charge_id: existing.asaas_charge_id,
        invoice_url: existing.invoice_url,
        pix_qr_code: existing.pix_qr_code,
        pix_payload: existing.pix_payload,
        value: existing.value,
        reused: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Body opcional
    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }
    const cpfCnpj: string | undefined = (body?.cpfCnpj || "").replace(/\D/g, "") || undefined;
    const phone: string | undefined = (body?.phone || "").replace(/\D/g, "") || undefined;
    const name: string = body?.name || user.user_metadata?.full_name || user.user_metadata?.username || (user.email || "Cliente Mycroft").split("@")[0];

    // 1) Cria/recupera customer
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
          name,
          email: user.email,
          ...(cpfCnpj ? { cpfCnpj } : {}),
          ...(phone ? { mobilePhone: phone } : {}),
          externalReference: user.id,
        }),
      });
      const custJson = await custRes.json();
      if (!custRes.ok || !custJson?.id) {
        await logEdgeError("asaas-create-charge", new Error("customer_create_failed"), { context: { res: custJson }, statusCode: custRes.status });
        return new Response(JSON.stringify({ error: "customer_create_failed", details: custJson }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = custJson.id;
    }

    // 2) Cria payment Pix
    const dueDate = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
    const payRes = await fetch(`${ASAAS_BASE}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: DAY_PASS_VALUE,
        dueDate,
        description: DAY_PASS_DESCRIPTION,
        externalReference: user.id, // chave que liga ao usuário no webhook
      }),
    });
    const payJson = await payRes.json();
    if (!payRes.ok || !payJson?.id) {
      await logEdgeError("asaas-create-charge", new Error("payment_create_failed"), { context: { res: payJson }, statusCode: payRes.status });
      return new Response(JSON.stringify({ error: "payment_create_failed", details: payJson }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Busca QR code Pix
    const qrRes = await fetch(`${ASAAS_BASE}/payments/${payJson.id}/pixQrCode`, {
      headers: { access_token: apiKey },
    });
    const qrJson = await qrRes.json();
    const pixQrCode = qrJson?.encodedImage ? `data:image/png;base64,${qrJson.encodedImage}` : null;
    const pixPayload = qrJson?.payload ?? null;
    const pixExpires = qrJson?.expirationDate ?? null;

    // 4) Persiste no DB
    const { error: insErr } = await sb.from("asaas_charges").insert({
      user_id: user.id,
      asaas_charge_id: payJson.id,
      asaas_customer_id: customerId,
      status: payJson.status || "PENDING",
      billing_type: "PIX",
      value: DAY_PASS_VALUE,
      description: DAY_PASS_DESCRIPTION,
      invoice_url: payJson.invoiceUrl ?? null,
      pix_qr_code: pixQrCode,
      pix_payload: pixPayload,
      pix_expires_at: pixExpires,
      product_slug: "day_pass",
      plan_target: "premium",
      duration_hours: 24,
      raw_create_response: payJson,
      environment: "sandbox",
    });
    if (insErr) console.warn("[asaas-create-charge] insert error:", insErr);

    return new Response(JSON.stringify({
      charge_id: payJson.id,
      invoice_url: payJson.invoiceUrl,
      pix_qr_code: pixQrCode,
      pix_payload: pixPayload,
      value: DAY_PASS_VALUE,
      reused: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    await logEdgeError("asaas-create-charge", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
