// E-mail EXPIRADO (D10) — reativação pessoal do Israel
import {
  buscarUsuariosElegiveis,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
  ASSINAR_URL,
  FROM_EMAIL_PESSOAL,
} from "../_shared/email-sequencia.ts";

function html(nome: string): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:#1a3a5c;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<h1 style="color:#fff;font-size:20px;margin:0 0 4px;">Oráculo Mycroft</h1>
<p style="color:#C49A00;font-size:13px;margin:0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Uma mensagem pessoal</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 18px;">Olá, <strong>${primeiro}</strong>.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 18px;">Meu nome é Israel, CEO do Oráculo Mycroft. Percebi que seu trial encerrou há alguns dias e queria te escrever pessoalmente.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 18px;">Não vou te mandar mais um e-mail cheio de promoções. Quero entender o que aconteceu. Você chegou até o Mycroft por algum motivo — e provavelmente ainda tem esse motivo.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#f0f6ff;border-left:4px solid #1a3a5c;padding:20px 22px;border-radius:0 10px 10px 0;">
<p style="color:#1a3a5c;font-size:15px;font-weight:700;margin:0 0 10px;">Posso te perguntar algo?</p>
<p style="color:#444;font-size:14px;line-height:1.7;margin:0;">O que faltou durante o trial? O sistema não era o que você esperava? O preço não fez sentido? Faltou tempo para testar direito? Ou só foi o momento errado?</p>
<p style="color:#444;font-size:14px;line-height:1.7;margin:8px 0 0;">Responde esse e-mail com a sua opinião honesta — eu leio e respondo pessoalmente.</p>
</td></tr></table>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 14px;">Caso queira saber o que evoluiu no sistema desde que você usou:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#f8f9fc;border-radius:10px;padding:18px 20px;">
<p style="color:#333;font-size:14px;margin:5px 0;">🆕 Plano Handicap Asiático com range validado por trader profissional</p>
<p style="color:#333;font-size:14px;margin:5px 0;">🆕 Categorias A/B/C — stake automático proporcional à confiança</p>
<p style="color:#333;font-size:14px;margin:5px 0;">🆕 Eventos Raros — Lay Goleada, Lay 2x2, Lay 1x3 com odds reais</p>
<p style="color:#333;font-size:14px;margin:5px 0;">🆕 Arena Trader Sports com 67% de win rate ao vivo</p>
<p style="color:#333;font-size:14px;margin:5px 0;">🆕 Lives toda terça, quarta, sábado e domingo</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:linear-gradient(135deg,#1a3a5c,#0d1f3c);border-radius:12px;padding:24px;text-align:center;">
<p style="color:#C49A00;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Quando quiser voltar</p>
<p style="color:#fff;font-size:18px;margin:0 0 6px;">Acesso imediato. Sem fidelidade.</p>
<p style="color:#aaa;font-size:13px;margin:0 0 18px;">Cancela quando quiser.</p>
<a href="${ASSINAR_URL}" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:8px;">Reativar acesso</a>
</td></tr></table>
<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 16px;">Independente da sua decisão, obrigado por ter testado o Mycroft. Construí esse sistema do zero para resolver um problema real que eu mesmo tinha — e fico feliz quando alguém dá uma chance.</p>
<p style="color:#1a3a5c;font-size:14px;font-weight:600;margin:0;">Israel Fideles<br><span style="color:#888;font-weight:400;font-size:12px;">CEO — Oráculo Mycroft</span><br><span style="color:#888;font-weight:400;font-size:12px;">Responde esse e-mail — eu leio pessoalmente.</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
<p style="color:#555;font-size:12px;margin:0;"><a href="${SITE_URL}" style="color:#666;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const usuarios = await buscarUsuariosElegiveis(10, 11, "EXPIRADO", true);
    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `${u.primeiro_nome}, uma pergunta rápida sobre seu trial`,
        html: html(u.full_name),
        text: `Olá ${u.primeiro_nome}, sou o Israel, CEO do Oráculo Mycroft. Quero entender o que faltou durante seu trial — responde esse e-mail. Para reativar: ${ASSINAR_URL}`,
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
