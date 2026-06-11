// E-mail EXPIRADO (D10) — reativação pessoal do Israel
import {
  buscarUsuariosElegiveis,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  ASSINAR_URL,
  FROM_EMAIL_PESSOAL,
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
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 16px;">Olá, <strong>${primeiro}</strong>.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 16px;">Sou o Israel, CEO do Oráculo Mycroft. Você entrou na plataforma há mais de uma semana e ainda não assinou. Queria te escrever pessoalmente antes de seguir em frente.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 24px;">Não vou te mandar mais um e-mail cheio de promoções. Quero entender o que aconteceu — e te mostrar o que o sistema continua entregando enquanto você está com acesso limitado:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f0f6ff;border-left:4px solid #1a3a5c;padding:18px 20px;border-radius:0 10px 10px 0;">
<p style="color:#1a3a5c;font-size:15px;font-weight:700;margin:0 0 8px;">Posso te perguntar algo?</p>
<p style="color:#444;font-size:13px;line-height:1.7;margin:0;">O que faltou durante o trial? O sistema não era o que você esperava? O preço não fez sentido? Faltou tempo para testar? Ou só foi o momento errado?</p>
<p style="color:#444;font-size:13px;line-height:1.7;margin:8px 0 0;">Responde esse e-mail com a sua opinião honesta — eu leio e respondo pessoalmente.</p>
</td></tr></table>

<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 12px;">O que evoluiu desde sua última visita:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f8f9fc;border-radius:10px;padding:16px 18px;">
<p style="color:#333;font-size:13px;margin:5px 0;">🆕 Plano Handicap Asiático com range validado por trader profissional</p>
<p style="color:#333;font-size:13px;margin:5px 0;">🆕 Categorias A/B/C — stake automático proporcional à confiança</p>
<p style="color:#333;font-size:13px;margin:5px 0;">🆕 Eventos Raros — Lay Goleada, Lay 2x2, Lay 1x3 com odds reais</p>
<p style="color:#333;font-size:13px;margin:5px 0;">🆕 Lives toda terça, quarta, sábado e domingo</p>
</td></tr></table>

${botaoCTA(ASSINAR_URL, "Reativar acesso")}
<p style="color:#888;font-size:12px;text-align:center;margin:0 0 20px;">Acesso imediato. Sem fidelidade. Cancela quando quiser.</p>

<p style="color:#444;font-size:13px;line-height:1.7;margin:0 0 0;">Independente da sua decisão, obrigado por ter testado o Mycroft. Construí esse sistema do zero para resolver um problema real que eu mesmo tinha.</p>`;

  return emailLayout({
    headerGradient: "#1a3a5c,#0d1f3c",
    headerEmoji: "✉️",
    headerTitle: "Uma mensagem pessoal",
    headerSubtitle: "Israel Fideles — CEO Oráculo Mycroft",
    bodyHtml: body,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ps = await buscarProvaSocial(7);
    const usuarios = await buscarUsuariosElegiveis(10, 11, "EXPIRADO", true);
    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `${u.primeiro_nome}, você entrou há 10 dias e ainda não assinou — posso perguntar por quê?`,
        html: html(u.full_name, ps),
        text: `Olá ${u.primeiro_nome}, sou o Israel, CEO do Oráculo Mycroft. Você está na plataforma há mais de uma semana sem assinar. ${ps.greens} greens em 7 dias enquanto você está com acesso limitado. Responde esse e-mail — eu leio. Assinar: ${ASSINAR_URL}`,
        sequencia: "EXPIRADO",
        userId: u.user_id,
        from: FROM_EMAIL_PESSOAL,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "EXPIRADO", r.id); enviados++; }
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
