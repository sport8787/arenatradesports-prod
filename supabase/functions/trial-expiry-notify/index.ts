// Envia avisos diários para usuários trial sobre o desconto de 50% OFF
// que expira junto com o período trial.
// Janelas: 7, 5, 3, 2, 1 dias restantes + janela especial "últimas 24h" (days_left=0).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 0 = janela especial "últimas 24h finais" (mensagem reforçada)
const NOTIFY_WINDOWS = [7, 5, 3, 2, 1, 0];
const OFFER_URL = "https://oraculo-mycroft.com/oferta-especial";

function buildEmailHtml(daysLeft: number, hoursLeft: number) {
  const isLast24h = daysLeft === 0;
  const urgent = daysLeft <= 2;

  const headline = isLast24h
    ? `🚨 ÚLTIMAS ${hoursLeft}h — 50% OFF expira junto com seu trial`
    : daysLeft === 1
    ? "⏰ ÚLTIMO DIA — 50% OFF expira hoje"
    : urgent
    ? `🔥 Faltam ${daysLeft} dias — 50% OFF acaba com seu trial`
    : `⏳ ${daysLeft} dias restantes — garanta 50% OFF antes que expire`;

  const tempoTexto = isLast24h
    ? `<b>${hoursLeft} hora${hoursLeft === 1 ? "" : "s"}</b>`
    : `<b>${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}</b>`;

  const reforco = isLast24h
    ? `<p style="color:#fca5a5;font-size:15px;line-height:1.5;background:#7f1d1d33;border-left:3px solid #ef4444;padding:10px 14px;border-radius:6px">
         ⚠️ <b>Esta é sua última chance.</b> Quando o trial acabar, o desconto de <b>50% OFF desaparece</b> — e o valor cheio passa a ser cobrado em qualquer assinatura futura.
       </p>`
    : "";

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid ${isLast24h ? "#ef444480" : "#f59e0b40"};border-radius:12px;padding:28px">
    <h1 style="color:${isLast24h ? "#ef4444" : "#f59e0b"};font-size:22px;margin:0 0 12px">${headline}</h1>
    <p style="color:#d4d4d4;font-size:15px;line-height:1.5">
      Seu período trial no <b>Oráculo Mycroft</b> termina em ${tempoTexto}.
    </p>
    <p style="color:#d4d4d4;font-size:15px;line-height:1.5">
      O cupom de <b style="color:#f59e0b">50% OFF</b> é exclusivo para quem assina <u>antes do fim do trial</u>.
      Depois que expirar, o desconto não estará mais disponível.
    </p>
    ${reforco}
    <div style="text-align:center;margin:28px 0">
      <a href="${OFFER_URL}" style="display:inline-block;background:linear-gradient(135deg,${isLast24h ? "#ef4444,#b91c1c" : "#f59e0b,#d97706"});color:#000;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:15px">
        ${isLast24h ? "Garantir 50% OFF agora →" : "Assinar com 50% OFF →"}
      </a>
    </div>
    <p style="color:#888;font-size:12px;text-align:center;margin-top:20px">
      Mycroft não torce. Ele calcula.<br/>
      <a href="${OFFER_URL}" style="color:#f59e0b">oraculo-mycroft.com</a>
    </p>
  </div></body></html>`;
}

function buildPushPayload(daysLeft: number, hoursLeft: number) {
  const isLast24h = daysLeft === 0;
  const title = isLast24h
    ? `🚨 ÚLTIMAS ${hoursLeft}h — 50% OFF expira com seu trial`
    : daysLeft === 1
    ? "⏰ ÚLTIMO DIA — 50% OFF expira hoje"
    : daysLeft <= 2
    ? `🔥 Faltam ${daysLeft} dias para o 50% OFF expirar`
    : `⏳ ${daysLeft} dias restantes do seu trial`;
  const body = isLast24h
    ? `Última chance: assine antes do fim do trial e garanta 50% OFF. Depois disso o desconto desaparece.`
    : `Garanta 50% OFF antes do fim do trial. Após expirar, o desconto não está mais disponível.`;
  return { title, body, url: OFFER_URL };
}

async function sendEmail(resendKey: string, to: string, daysLeft: number, hoursLeft: number) {
  const subject = daysLeft === 0
    ? `🚨 Últimas ${hoursLeft}h: 50% OFF expira junto com seu trial`
    : daysLeft === 1
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
      html: buildEmailHtml(daysLeft, hoursLeft),
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
    const oneHour = 3600000;

    for (const s of subs || []) {
      const ends = new Date(s.trial_ends_at!).getTime();
      const msLeft = ends - now;
      if (msLeft <= 0) continue; // já expirou

      const hoursLeft = Math.max(1, Math.ceil(msLeft / oneHour));
      const daysLeftRaw = Math.ceil(msLeft / oneDay);

      // Janela "últimas 24h": dispara quando faltam <= 24h e ainda não expirou.
      // Usa days_left = 0 no log para diferenciar da janela de 1 dia.
      let windowKey: number;
      if (msLeft <= oneDay) {
        windowKey = 0;
      } else if (NOTIFY_WINDOWS.includes(daysLeftRaw)) {
        windowKey = daysLeftRaw;
      } else {
        continue;
      }

      result.processed++;

      const { data: u } = await admin.auth.admin.getUserById(s.user_id);
      const email = u?.user?.email;
      if (!email) continue;

      // EMAIL — verifica log
      const { data: alreadyEmail } = await admin
        .from("trial_notification_log")
        .select("id")
        .eq("user_id", s.user_id)
        .eq("days_left", windowKey)
        .eq("channel", "email")
        .maybeSingle();

      if (!alreadyEmail) {
        try {
          await sendEmail(resendKey, email, windowKey, hoursLeft);
          await admin.from("trial_notification_log").insert({
            user_id: s.user_id, days_left: windowKey, channel: "email",
          });
          result.emails_sent++;
        } catch (e) {
          result.errors.push(`email ${email}: ${String(e)}`);
        }
      }

      // PUSH
      const { data: pushSubs } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", s.user_id);

      if (pushSubs && pushSubs.length > 0) {
        const { data: alreadyPush } = await admin
          .from("trial_notification_log")
          .select("id")
          .eq("user_id", s.user_id)
          .eq("days_left", windowKey)
          .eq("channel", "push")
          .maybeSingle();

        if (!alreadyPush) {
          try {
            const payload = buildPushPayload(windowKey, hoursLeft);
            await admin.functions.invoke("send-web-push", {
              body: { user_ids: [s.user_id], payload },
            });
            await admin.from("trial_notification_log").insert({
              user_id: s.user_id, days_left: windowKey, channel: "push",
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
