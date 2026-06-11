// E-mail D5 — Urgência (5 dias após cadastro, não-assinantes)
import {
  buscarUsuariosElegiveis,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  ASSINAR_URL,
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
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, você ainda não assinou 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Você está na plataforma há 5 dias e o sistema continua entregando resultados. Veja o que você pode estar perdendo por não operar com acesso completo:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#fff5f5;border:1px solid #fecaca;border-radius:12px;padding:20px;">
<p style="color:#991b1b;font-size:14px;font-weight:700;margin:0 0 10px;">❌ Sem plano premium você fica sem:</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Arena Live — sinais ao vivo com IA</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Mycroft Punter — sinais pré-live com Value Expected</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Plano Favorito + Handicap Asiático + Eventos Raros</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Lives semanais e Grupo VIP no Telegram</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;">
<p style="color:#14532d;font-size:14px;font-weight:700;margin:0 0 10px;">✅ Assinando agora você garante:</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Acesso completo a todos os módulos</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Todo o histórico e análises disponíveis</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• <strong>50% OFF exclusivo</strong> para novos assinantes</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Cancele quando quiser. Sem fidelidade.</p>
</td></tr></table>

${botaoCTA(ASSINAR_URL, "🔐 Garantir 50% OFF agora")}
<p style="color:#888;font-size:12px;text-align:center;margin:0 0 16px;">Cancele quando quiser. Sem fidelidade.</p>`;

  return emailLayout({
    headerGradient: "#7f1d1d,#991b1b",
    headerEmoji: "⏳",
    headerTitle: "5 dias e você ainda não assinou",
    headerSubtitle: "O Oráculo Mycroft continua entregando — você está perdendo",
    bodyHtml: body,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ps = await buscarProvaSocial(7);
    const usuarios = await buscarUsuariosElegiveis(5, 6, "D5", true);
    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `⏳ ${u.primeiro_nome}, ${ps.greens} greens em 7 dias — você ainda não assinou (50% OFF)`,
        html: html(u.full_name, ps),
        text: `${u.primeiro_nome}, 5 dias no Mycroft e você ainda não assinou. ${ps.greens} greens em 7 dias (${ps.wr}% WR). Garanta 50% OFF: ${ASSINAR_URL}`,
        sequencia: "D5",
        userId: u.user_id,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "D5", r.id); enviados++; }
      else erros++;
      await new Promise(r => setTimeout(r, 150));
    }
    return new Response(JSON.stringify({ success: true, enviados, erros, total: usuarios.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
