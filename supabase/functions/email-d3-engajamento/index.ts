// E-mail D3 — Engajamento (3 dias após cadastro, não-assinantes)
import {
  buscarUsuariosElegiveis,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
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
<h2 style="color:#1a3a5c;font-size:22px;margin:0 0 14px;">${primeiro}, o Mycroft está trabalhando 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 24px;">Você está explorando o sistema há 3 dias. Veja o que o Mycroft entregou enquanto você ainda está conhecendo a plataforma:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-left:4px solid #C49A00;padding:14px 18px;background:#fffbeb;border-radius:0 8px 8px 0;">
<p style="color:#92400e;font-size:14px;font-weight:700;margin:0 0 4px;">📊 Esses resultados são de operações reais</p>
<p style="color:#78350f;font-size:13px;margin:0;">Continue acompanhando os sinais e veja na prática como o método funciona. Para ter acesso completo com todas as funcionalidades, assine o plano premium.</p>
</td></tr></table>

${botaoCTA(`${SITE_URL}/lobby`, "🚀 Acessar o sistema agora")}`;

  return emailLayout({
    headerGradient: "#0d1f3c,#1a3a5c",
    headerEmoji: "⚽",
    headerTitle: "3 dias no Oráculo Mycroft",
    headerSubtitle: "Resultados reais entregues pelo sistema",
    bodyHtml: body,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ps = await buscarProvaSocial(7);
    const usuarios = await buscarUsuariosElegiveis(3, 4, "D3", true);

    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `⚽ ${ps.greens} greens em 7 dias — veja o que o Mycroft entregou`,
        html: html(u.full_name, ps),
        text: `${u.primeiro_nome}, o Mycroft está operando. Últimos 7 dias: ${ps.greens} greens em ${ps.total} sinais (${ps.wr}% WR). Acesse: ${SITE_URL}/lobby`,
        sequencia: "D3",
        userId: u.user_id,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "D3", r.id); enviados++; }
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
