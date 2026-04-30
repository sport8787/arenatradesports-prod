// E-mail D7 — Último dia (7 dias após cadastro, não-assinantes)
import {
  buscarUsuariosElegiveis,
  buscarResumoDias,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
  ASSINAR_URL,
} from "../_shared/email-sequencia.ts";

function html(nome: string, greens: number, reds: number, wr: number, lucro: number): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#1a3a5c,#0d1f3c);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
<div style="font-size:40px;margin-bottom:10px;">🔮</div>
<h1 style="color:#C49A00;font-size:26px;margin:0 0 6px;">Hoje é o último dia</h1>
<p style="color:#aaa;font-size:14px;margin:0;">do seu trial gratuito do Oráculo Mycroft</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 16px;">${primeiro}, o trial encerra hoje à meia-noite.</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 24px;">Você ficou 7 dias com acesso ao sistema. Aqui está o resumo do que o Mycroft fez nesse período:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:linear-gradient(135deg,#1a3a5c,#0d1f3c);border-radius:14px;padding:28px;">
<p style="color:#C49A00;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;margin:0 0 20px;">Resultados dos últimos 7 dias</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="text-align:center;padding:0 8px;"><div style="color:#22c55e;font-size:40px;font-weight:700;line-height:1;">${greens}</div><div style="color:#aaa;font-size:12px;margin-top:4px;">Greens</div></td>
<td style="text-align:center;padding:0 8px;"><div style="color:#ef4444;font-size:40px;font-weight:700;line-height:1;">${reds}</div><div style="color:#aaa;font-size:12px;margin-top:4px;">Reds</div></td>
<td style="text-align:center;padding:0 8px;"><div style="color:#C49A00;font-size:40px;font-weight:700;line-height:1;">${wr}%</div><div style="color:#aaa;font-size:12px;margin-top:4px;">Win Rate</div></td>
<td style="text-align:center;padding:0 8px;"><div style="color:#22c55e;font-size:28px;font-weight:700;line-height:1;">R$${(lucro/1000).toFixed(1)}k</div><div style="color:#aaa;font-size:12px;margin-top:4px;">Lucro</div></td>
</tr></table>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:22px;">
<p style="color:#92400e;font-size:15px;font-weight:700;margin:0 0 12px;">Uma decisão simples:</p>
<table width="100%"><tr>
<td width="48%" style="vertical-align:top;padding-right:8px;"><div style="background:#fff5f5;border-radius:8px;padding:14px;"><p style="color:#991b1b;font-size:13px;font-weight:700;margin:0 0 8px;">❌ Sem assinatura</p><p style="color:#7f1d1d;font-size:12px;margin:0;">Perde acesso. Volta a operar sem dados, sem IA, sem método.</p></div></td>
<td width="4%"></td>
<td width="48%" style="vertical-align:top;padding-left:8px;"><div style="background:#f0fdf4;border-radius:8px;padding:14px;"><p style="color:#14532d;font-size:13px;font-weight:700;margin:0 0 8px;">✅ Com assinatura</p><p style="color:#15803d;font-size:12px;margin:0;">Continua com o Mycroft. <strong>50% OFF</strong>. Acesso imediato.</p></div></td>
</tr></table>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center">
<a href="${ASSINAR_URL}" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:18px;font-weight:700;text-decoration:none;padding:18px 48px;border-radius:10px;">🔐 Assinar agora com 50% OFF</a>
</td></tr></table>
<p style="color:#888;font-size:13px;text-align:center;margin:0 0 28px;">Cancele quando quiser. Sem fidelidade.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-left:3px solid #1a3a5c;padding:14px 18px;background:#f8f9fc;border-radius:0 8px 8px 0;">
<p style="color:#444;font-size:14px;line-height:1.7;margin:0;">Se tiver qualquer dúvida ou quiser conversar antes de decidir, responde este e-mail. Quero entender o que funcionou para você nesses 7 dias — independente da sua decisão.</p>
</td></tr></table>
<p style="color:#1a3a5c;font-size:14px;font-weight:600;margin:0;">Israel Fideles<br><span style="color:#888;font-weight:400;font-size:12px;">CEO — Oráculo Mycroft</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
<p style="color:#555;font-size:12px;margin:0;"><a href="${SITE_URL}" style="color:#666;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { greensCount, redsCount, wr, lucro } = await buscarResumoDias(7);
    const usuarios = await buscarUsuariosElegiveis(7, 8, "D7", true);

    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `🔮 ${u.primeiro_nome}, hoje é o último dia do seu trial`,
        html: html(u.full_name, greensCount, redsCount, wr, lucro),
        text: `${u.primeiro_nome}, seu trial expira hoje. ${wr}% win rate em 7 dias. Assine com 50% OFF: ${ASSINAR_URL}`,
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
