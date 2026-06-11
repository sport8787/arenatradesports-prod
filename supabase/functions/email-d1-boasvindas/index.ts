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
import {
  buscarProvaSocial,
  blocoProvaSocial,
  blocoCardDestaque,
  emailLayout,
  botaoCTA,
  type ProvaSocial,
} from "../_shared/email-template.ts";

function html(nome: string, ps: ProvaSocial): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  const body = `
<h2 style="color:#1a3a5c;font-size:22px;margin:0 0 14px;">Bem-vindo, ${primeiro}! 👋</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Você acaba de entrar no <strong>Oráculo Mycroft</strong> — o sistema de trading esportivo com Inteligência Artificial que já entregou centenas de greens. Aqui está o que aconteceu nos últimos 7 dias enquanto você ainda estava de fora:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<p style="color:#1a3a5c;font-size:15px;font-weight:700;margin:0 0 12px;">🎯 O que você tem acesso agora:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f0f6ff;border-radius:12px;padding:20px;">
<p style="margin:6px 0;color:#1a3a5c;font-size:14px;">✅ <strong>Arena Live</strong> — sinais ao vivo com IA</p>
<p style="margin:6px 0;color:#1a3a5c;font-size:14px;">✅ <strong>Mycroft Punter</strong> — sinais pré-live com Value Expected positivo</p>
<p style="margin:6px 0;color:#1a3a5c;font-size:14px;">✅ <strong>Gestão de banca</strong> — Kelly Criterion automático</p>
<p style="margin:6px 0;color:#1a3a5c;font-size:14px;">✅ <strong>Histórico e performance</strong> — win rate e ROI em tempo real</p>
<p style="margin:6px 0;color:#1a3a5c;font-size:14px;">✅ <strong>Lives semanais</strong> — operações ao vivo (ter, qua, sáb, dom)</p>
</td></tr></table>

${botaoCTA(`${SITE_URL}/lobby`, "🚀 Acessar o Oráculo Mycroft")}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-left:4px solid #C49A00;padding:14px 18px;background:#fffbeb;border-radius:0 8px 8px 0;">
<p style="color:#854f0b;font-size:14px;font-weight:700;margin:0 0 4px;">💡 Dica para começar</p>
<p style="color:#5d4037;font-size:13px;line-height:1.6;margin:0;">Comece pela <strong>Arena Live</strong> e observe os sinais ao vivo antes de operar. Entenda como o Mycroft analisa cada entrada, depois entre com sua banca.</p>
</td></tr></table>

<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 8px;">📱 Entre também no nosso grupo VIP no Telegram:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td align="center" style="padding-top:8px;">
<a href="${TELEGRAM_URL}" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 28px;border-radius:8px;">Entrar no Telegram</a>
</td></tr></table>
<p style="color:#444;font-size:14px;line-height:1.7;margin:14px 0 0;">Qualquer dúvida, responde este e-mail. Estou aqui para te ajudar.</p>`;

  return emailLayout({
    headerGradient: "#0d1f3c,#1a3a5c",
    headerEmoji: "🔮",
    headerTitle: "Bem-vindo ao Oráculo Mycroft",
    headerSubtitle: "Trading esportivo com Inteligência Artificial",
    bodyHtml: body,
  });
}

function text(nome: string, ps: ProvaSocial): string {
  const p = nome.split(" ")[0] || "Trader";
  return `Bem-vindo, ${p}!

Seu acesso ao Oráculo Mycroft está ativo.
Últimos 7 dias: ${ps.greens} greens em ${ps.total} sinais (${ps.wr}% win rate).

Acesse: ${SITE_URL}/lobby

— Israel Fideles, CEO`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let usuarios: UsuarioAlvo[] = [];

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

    const ps = await buscarProvaSocial(7);
    let enviados = 0, erros = 0, ignorados = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `🔮 Bem-vindo, ${u.primeiro_nome}! ${ps.greens} greens em 7 dias te aguardam`,
        html: html(u.full_name, ps),
        text: text(u.full_name, ps),
        sequencia: "D1",
        userId: u.user_id,
      });
      if (r.ok) {
        await registrarEnvio(u.user_id, u.email, "D1", r.id, "sent");
        enviados++;
      } else {
        await registrarEnvio(
          u.user_id, u.email, "D1", undefined, "failed",
          typeof r.error === "string" ? r.error : JSON.stringify(r.error ?? {}).slice(0, 500),
        );
        erros++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ success: true, enviados, ignorados, erros, prova_social: { greens: ps.greens, total: ps.total, wr: ps.wr } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
