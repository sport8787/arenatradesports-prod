// Envia avisos diários para usuários trial sobre o desconto de 50% OFF
// que expira junto com o período trial. Janelas: 7, 5, 3, 2, 1 dias restantes.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_WINDOWS = [7, 5, 3, 2, 1];
const OFFER_URL = "https://oraculo-mycroft.com/oferta-especial";

function buildEmailHtml(daysLeft: number) {
  const urgent = daysLeft <= 2;
  const headline = daysLeft === 1
    ? "⏰ ÚLTIMO DIA — 50% OFF expira hoje"
    : urgent
    ? `🔥 Faltam ${daysLeft} dias — 50% OFF acaba com seu trial`
    : `⏳ ${daysLeft} dias restantes — garanta 50% OFF antes que expire`;

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #f59e0b40;border-radius:12px;padding:28px">
    <h1 style="color:#f59e0b;font-size:22px;margin:0 0 12px">${headline}</h1>
    <p style="color:#d4d4d4;font-size:15px;line-height:1.5">
      Seu período trial no <b>Oráculo Mycroft</b> termina em <b>${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}</b>.
    </p>
    <p style="color:#d4d4d4;font-size:15px;line-height:1.5">
      O cupom de <b style="color:#f59e0b">50% OFF</b> é exclusivo para quem assina <u>antes do fim do trial</u>.
      Depois que expirar, o desconto não estará mais disponível.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${OFFER_URL}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:15px">
        Assinar com 50% OFF →
      </a>
    </div>
    <p style="color:#888;font-size:12px;text-align:center;margin-top:20px">
      Mycroft não torce. Ele calcula.<br/>
      <a href="${OFFER_URL}" style="color:#f59e0b">oraculo-mycroft.com</a>
    </p>
  </div></body></html>`;
}

function buildPushPayload(daysLeft: number) {
  const title = daysLeft === 1
    ? "⏰ ÚLTIMO DIA — 50% OFF expira hoje"
    : daysLeft <= 2
    ? `🔥 Faltam ${daysLeft} dias para o 50% OFF expirar`
    : `⏳ ${daysLeft} dias restantes do seu trial`;
  const body = `Garanta 50% OFF antes do fim do trial. Após expirar, o desconto não está mais disponível.`;
  return { title, body, url: OFFER_URL };
}

async function sendEmail(resendKey: string, to: string, daysLeft: number) {
  const subject = daysLeft === 1
    ? "⏰ Último dia: 50% OFF expira hoje com seu trial"
    : `🔥 ${daysLeft} dias restantes — 50% OFF acaba com seu trial`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Oráculo Mycroft <noreply@oraculo-mycroft.com>",
      to: [to],
      subject,
      html: buildEmailHtml(daysLeft),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend ${r.status}: ${t}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const result = { processed: 0, emails_sent: 0, push_sent: 0, errors: [] as string[] };

  try {
    const { data: subs, error } = await admin
      .from("user_subscriptions")
      .select("user_id, plan, trial_ends_at")
      .eq("plan", "trial")
      .not("trial_ends_at", "is", null);

    if (error) throw error;

    const now = Date.now();
    const oneDay = 86400000;

    for (const s of subs || []) {
      const ends = new Date(s.trial_ends_at!).getTime();
      const daysLeft = Math.ceil((ends - now) / oneDay);
      if (!NOTIFY_WINDOWS.includes(daysLeft)) continue;

      result.processed++;

      // Buscar email
      const { data: u } = await admin.auth.admin.getUserById(s.user_id);
      const email = u?.user?.email;
      if (!email) continue;

      // EMAIL — verifica log
      const { data: alreadyEmail } = await admin
        .from("trial_notification_log")
        .select("id")
        .eq("user_id", s.user_id)
        .eq("days_left", daysLeft)
        .eq("channel", "email")
        .maybeSingle();

      if (!alreadyEmail) {
        try {
          await sendEmail(resendKey, email, daysLeft);
          await admin.from("trial_notification_log").insert({
            user_id: s.user_id, days_left: daysLeft, channel: "email",
          });
          result.emails_sent++;
        } catch (e) {
          result.errors.push(`email ${email}: ${String(e)}`);
        }
      }

      // PUSH — invoca send-push (se existir) ou pula
      const { data: pushSubs } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", s.user_id);

      if (pushSubs && pushSubs.length > 0) {
        const { data: alreadyPush } = await admin
          .from("trial_notification_log")
          .select("id")
          .eq("user_id", s.user_id)
          .eq("days_left", daysLeft)
          .eq("channel", "push")
          .maybeSingle();

        if (!alreadyPush) {
          try {
            const payload = buildPushPayload(daysLeft);
            await admin.functions.invoke("send-web-push", {
              body: { user_id: s.user_id, ...payload },
            });
            await admin.from("trial_notification_log").insert({
              user_id: s.user_id, days_left: daysLeft, channel: "push",
            });
            result.push_sent++;
          } catch (e) {
            result.errors.push(`push ${s.user_id}: ${String(e)}`);
          }
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), ...result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
