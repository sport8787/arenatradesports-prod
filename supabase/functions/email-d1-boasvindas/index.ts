// E-mail D1 — Boas-vindas (dia do cadastro / nas últimas 24h)
import {
  buscarUsuariosD1,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
  TELEGRAM_URL,
  type UsuarioAlvo,
} from "../_shared/email-sequencia.ts";

function html(nome: string): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bem-vindo ao Oráculo Mycroft</title></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#0d1f3c 0%,#1a3a5c 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
<div style="font-size:32px;margin-bottom:8px;">🔮</div>
<h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 8px;">Oráculo Mycroft</h1>
<p style="color:#C49A00;font-size:14px;margin:0;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Trading Esportivo com Inteligência Artificial</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:24px;margin:0 0 16px;">Bem-vindo, ${primeiro}! 👋</h2>
<p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 20px;">Você acaba de entrar no <strong>Oráculo Mycroft</strong> — o sistema de análise de trading esportivo mais avançado do Brasil, alimentado por Inteligência Artificial.</p>
<p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 28px;">Seu trial de <strong>7 dias</strong> está ativo agora. Você tem acesso completo a:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#f0f6ff;border-radius:12px;padding:24px;">
<p style="margin:8px 0;color:#1a3a5c;font-size:15px;">✅ <strong>Arena Trader Sports</strong> — sinais ao vivo com IA analisando cada jogo em tempo real</p>
<p style="margin:8px 0;color:#1a3a5c;font-size:15px;">✅ <strong>Mycroft Punter</strong> — sinais pré-live com Value Expected positivo e Modelo Poisson</p>
<p style="margin:8px 0;color:#1a3a5c;font-size:15px;">✅ <strong>Gestão de banca</strong> — Kelly Criterion calculado automaticamente</p>
<p style="margin:8px 0;color:#1a3a5c;font-size:15px;">✅ <strong>Histórico e performance</strong> — win rate e ROI em tempo real</p>
<p style="margin:8px 0;color:#1a3a5c;font-size:15px;">✅ <strong>Lives semanais</strong> — operações ao vivo (ter, qua, sáb, dom)</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td align="center">
<a href="${SITE_URL}/punter" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:17px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;">🚀 Acessar o Oráculo Mycroft</a>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="border-left:4px solid #C49A00;padding:16px 20px;background:#fffbeb;border-radius:0 8px 8px 0;">
<p style="color:#854f0b;font-size:14px;font-weight:700;margin:0 0 6px;">💡 Dica para começar</p>
<p style="color:#5d4037;font-size:14px;line-height:1.6;margin:0;">Comece pela <strong>Arena Trader Sports</strong> e observe os sinais ao vivo sem apostar nos primeiros 2 dias. Entenda como o Mycroft analisa, os critérios de aprovação e os horários de maior volume. Depois entre com sua banca.</p>
</td></tr></table>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 8px;">📱 Entre também no nosso grupo exclusivo no Telegram:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td align="center" style="padding-top:12px;">
<a href="${TELEGRAM_URL}" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">Entrar no Telegram</a>
</td></tr></table>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0;">Qualquer dúvida, responda este e-mail. Estou aqui para te ajudar.</p>
<p style="color:#1a3a5c;font-size:15px;font-weight:600;margin:20px 0 0;">Bom trading,<br><strong>Israel Fideles</strong><br><span style="color:#888;font-weight:400;font-size:13px;">CEO — Oráculo Mycroft</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
<p style="color:#666;font-size:12px;margin:0;">Você recebeu este e-mail porque se cadastrou no Oráculo Mycroft. <a href="${SITE_URL}" style="color:#888;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function text(nome: string): string {
  const p = nome.split(" ")[0] || "Trader";
  return `Bem-vindo, ${p}!

Seu trial de 7 dias do Oráculo Mycroft está ativo. Acesse: ${SITE_URL}/punter

— Israel Fideles, CEO`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let usuarios: UsuarioAlvo[] = [];

    // Disparo manual {user_id,email,full_name}
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.user_id && body.email) {
        usuarios = [{
          user_id: body.user_id,
          email: body.email,
          full_name: body.full_name || body.email,
          primeiro_nome: String(body.full_name || body.email).split(" ")[0],
        }];
      }
    }

    if (usuarios.length === 0) {
      usuarios = await buscarUsuariosD1();
    }

    let enviados = 0, erros = 0, ignorados = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `🔮 Bem-vindo ao Oráculo Mycroft, ${u.primeiro_nome}! Seu trial está ativo`,
        html: html(u.full_name),
        text: text(u.full_name),
        sequencia: "D1",
        userId: u.user_id,
      });
      if (r.ok) {
        await registrarEnvio(u.user_id, u.email, "D1", r.id, "sent");
        enviados++;
      } else {
        await registrarEnvio(
          u.user_id,
          u.email,
          "D1",
          undefined,
          "failed",
          typeof r.error === "string" ? r.error : JSON.stringify(r.error ?? {}).slice(0, 500),
        );
        erros++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ success: true, enviados, ignorados, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
