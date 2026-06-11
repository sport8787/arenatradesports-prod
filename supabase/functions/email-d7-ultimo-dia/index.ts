// E-mail D7 — Último dia (7 dias após cadastro, não-assinantes)
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
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, 7 dias e você ainda não assinou.</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 24px;">Uma semana com acesso ao sistema e o Mycroft continua entregando. Veja o resumo real do que aconteceu:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:20px;">
<p style="color:#92400e;font-size:15px;font-weight:700;margin:0 0 12px;">A decisão é simples:</p>
<table width="100%"><tr>
<td width="48%" style="vertical-align:top;padding-right:6px;"><div style="background:#fff5f5;border-radius:8px;padding:12px;"><p style="color:#991b1b;font-size:12px;font-weight:700;margin:0 0 6px;">❌ Sem assinatura</p><p style="color:#7f1d1d;font-size:12px;margin:0;line-height:1.5;">Acesso limitado. Opera sem dados, sem IA, sem método validado.</p></div></td>
<td width="4%"></td>
<td width="48%" style="vertical-align:top;padding-left:6px;"><div style="background:#f0fdf4;border-radius:8px;padding:12px;"><p style="color:#14532d;font-size:12px;font-weight:700;margin:0 0 6px;">✅ Com assinatura</p><p style="color:#15803d;font-size:12px;margin:0;line-height:1.5;">Acesso completo ao Mycroft. <strong>50% OFF</strong> para novos assinantes.</p></div></td>
</tr></table>
</td></tr></table>

${botaoCTA(ASSINAR_URL, "🔐 Assinar agora com 50% OFF")}
<p style="color:#888;font-size:12px;text-align:center;margin:0 0 20px;">Cancele quando quiser. Sem fidelidade.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border-left:3px solid #1a3a5c;padding:14px 18px;background:#f8f9fc;border-radius:0 8px 8px 0;">
<p style="color:#444;font-size:13px;line-height:1.7;margin:0;">Se quiser conversar antes de decidir, responde este e-mail. Quero entender o que funcionou e o que não funcionou — independente da sua decisão.</p>
</td></tr></table>`;

  return emailLayout({
    headerGradient: "#1a3a5c,#0d1f3c",
    headerEmoji: "🔮",
    headerTitle: "Uma semana no Oráculo Mycroft",
    headerSubtitle: "e você ainda não tem o plano completo",
    bodyHtml: body,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ps = await buscarProvaSocial(7);
    const usuarios = await buscarUsuariosElegiveis(7, 8, "D7", true);

    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `🔮 ${u.primeiro_nome}, 7 dias no Mycroft — ainda não assinou? (50% OFF)`,
        html: html(u.full_name, ps),
        text: `${u.primeiro_nome}, 7 dias no Mycroft e você ainda não tem o plano completo. ${ps.greens} greens em ${ps.total} sinais (${ps.wr}% WR). Assine com 50% OFF: ${ASSINAR_URL}`,
        sequencia: "D7",
        userId: u.user_id,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "D7", r.id); enviados++; }
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
