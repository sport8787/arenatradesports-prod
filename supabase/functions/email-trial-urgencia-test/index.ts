// Envio pontual do e-mail "trial expirando + 50% OFF" para um destinatário específico (teste manual).
// Registra o resultado em email_sequencia_log com sequencia='D5' (status sent/failed).
import {
  corsHeaders,
  RESEND_API_KEY,
  FROM_EMAIL,
  REPLY_TO,
  ASSINAR_URL,
  SITE_URL,
  supabase,
} from "../_shared/email-sequencia.ts";

function html(nome: string): string {
  const primeiro = (nome || "Trader").split(" ")[0];
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#7f1d1d,#991b1b);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<div style="font-size:36px;margin-bottom:8px;">⏳</div>
<h1 style="color:#fff;font-size:22px;margin:0 0 6px;">Faltam poucos dias</h1>
<p style="color:#fca5a5;font-size:14px;margin:0;">Seu trial do Oráculo Mycroft expira em breve</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, não perca o acesso 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Em poucos dias seu trial gratuito encerra. Quando isso acontecer, você perde acesso a todos os sinais — ao vivo e pré-live — e ao histórico de análises.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#fff5f5;border:1px solid #fecaca;border-radius:12px;padding:22px;">
<p style="color:#991b1b;font-size:14px;font-weight:700;margin:0 0 12px;">❌ O que você perde ao expirar:</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Arena Trader Sports — sinais ao vivo com IA</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Mycroft Punter — sinais pré-live com Value Expected</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Plano Favorito + Handicap Asiático + Eventos Raros</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Lives semanais (ter, qua, sáb, dom)</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Grupo VIP no Telegram com sinais em tempo real</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:22px;">
<p style="color:#14532d;font-size:14px;font-weight:700;margin:0 0 12px;">✅ O que você garante assinando agora:</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Acesso contínuo sem interrupção</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Todo o histórico e resultados preservados</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• <strong>50% OFF exclusivo</strong> para quem assina antes do trial expirar</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Cancele quando quiser. Sem fidelidade.</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td align="center">
<a href="${ASSINAR_URL}" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:17px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:10px;">🔐 Garantir 50% OFF agora</a>
</td></tr></table>
<p style="color:#888;font-size:13px;text-align:center;margin:0 0 24px;">Cancele quando quiser. Sem fidelidade.</p>
<p style="color:#1a3a5c;font-size:14px;font-weight:600;margin:16px 0 0;">Israel Fideles<br><span style="color:#888;font-weight:400;font-size:12px;">CEO — Oráculo Mycroft</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
<p style="color:#555;font-size:12px;margin:0;"><a href="${SITE_URL}" style="color:#666;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body?.email;
    const full_name: string = body?.full_name || body?.nome || "Trader";
    const user_id: string = body?.user_id || "00000000-0000-0000-0000-000000000001";
    const sequencia: "D5" = "D5";

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ ok: false, error: "email inválido (obrigatório)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const primeiro = full_name.split(" ")[0];
    console.log(`[trial-urgencia-test] enviando para ${email} (${full_name})`);

    let resendOk = false;
    let resendStatus = 0;
    let resendId: string | undefined;
    let resendBody: any = null;
    let errorMessage: string | undefined;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          reply_to: REPLY_TO,
          subject: `⏳ ${primeiro}, seu trial do Oráculo Mycroft está expirando — 50% OFF`,
          html: html(full_name),
          tags: [
            { name: "sequencia", value: sequencia },
            { name: "modo", value: "teste-pontual" },
          ],
        }),
      });
      resendStatus = r.status;
      resendOk = r.ok;
      const txt = await r.text();
      try {
        resendBody = JSON.parse(txt);
      } catch {
        resendBody = txt;
      }
      if (resendOk) {
        resendId = resendBody?.id;
      } else {
        errorMessage = typeof resendBody === "string"
          ? resendBody
          : (resendBody?.message || JSON.stringify(resendBody));
      }
    } catch (e) {
      errorMessage = `exceção fetch Resend: ${String(e)}`;
      console.error(errorMessage);
    }

    // Registra status no log (sent/failed). Usa upsert para não duplicar por user_id+sequencia.
    const status = resendOk ? "sent" : "failed";
    const { error: logErr } = await supabase.from("email_sequencia_log").upsert(
      {
        user_id,
        email,
        sequencia,
        resend_id: resendId ?? null,
        status,
        error_message: errorMessage ?? null,
        enviado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,sequencia" },
    );
    if (logErr) console.error("[trial-urgencia-test] erro ao gravar log:", logErr);

    return new Response(
      JSON.stringify({
        ok: resendOk,
        status,
        resend_status: resendStatus,
        resend_id: resendId,
        resend_body: resendBody,
        log_error: logErr?.message,
      }),
      {
        status: resendOk ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
