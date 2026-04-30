// E-mail D3 — Engajamento (3 dias após cadastro, não-assinantes)
import {
  buscarUsuariosElegiveis,
  buscarResumoDias,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
} from "../_shared/email-sequencia.ts";

function html(nome: string, wr: number, greens: any[]): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  const greenRows = greens.slice(0, 3).map(g =>
    `<tr><td style="padding:8px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${g.home_team} x ${g.away_team}</td>
    <td style="padding:8px 12px;font-size:13px;color:#333;text-align:center;border-bottom:1px solid #f0f0f0;">${g.market}</td>
    <td style="padding:8px 12px;font-size:13px;color:#16a34a;font-weight:600;text-align:center;border-bottom:1px solid #f0f0f0;">✅ GREEN</td></tr>`
  ).join("") || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#888;font-size:13px;">Resultados sendo atualizados...</td></tr>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#0d1f3c,#1a3a5c);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<div style="font-size:28px;margin-bottom:6px;">⚽</div>
<h1 style="color:#fff;font-size:22px;margin:0 0 4px;">Oráculo Mycroft</h1>
<p style="color:#C49A00;font-size:13px;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:1px;">3º dia do seu trial</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:22px;margin:0 0 14px;">${primeiro}, o Mycroft está trabalhando 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 24px;">Você está no <strong>3º dia do trial</strong>. Veja o que o sistema fez recentemente:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:linear-gradient(135deg,#1a3a5c,#0d1f3c);border-radius:12px;padding:28px;text-align:center;">
<p style="color:#C49A00;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Win Rate da semana</p>
<div style="color:#22c55e;font-size:56px;font-weight:700;line-height:1;margin-bottom:6px;">${wr}%</div>
<p style="color:#aaa;font-size:13px;margin:0;">de acerto nas análises automáticas</p>
</td></tr></table>
<h3 style="color:#1a3a5c;font-size:16px;margin:0 0 12px;">Últimos greens do sistema:</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:28px;">
<tr style="background:#f8f9fc;"><th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;">Jogo</th>
<th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;">Mercado</th>
<th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;">Resultado</th></tr>
${greenRows}
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-left:4px solid #C49A00;padding:14px 18px;background:#fffbeb;border-radius:0 8px 8px 0;">
<p style="color:#92400e;font-size:14px;font-weight:700;margin:0 0 4px;">⏳ Seu trial expira em 4 dias</p>
<p style="color:#78350f;font-size:13px;margin:0;">Continue operando e veja na prática. Para garantir acesso contínuo, assine antes do trial expirar.</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td align="center">
<a href="${SITE_URL}/punter" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:16px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:10px;">🚀 Acessar o sistema agora</a>
</td></tr></table>
<p style="color:#1a3a5c;font-size:14px;font-weight:600;margin:16px 0 0;">Bom trading,<br><strong>Israel Fideles</strong><br><span style="color:#888;font-weight:400;font-size:12px;">CEO — Oráculo Mycroft</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
<p style="color:#555;font-size:12px;margin:0;"><a href="${SITE_URL}" style="color:#777;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { wr, greens } = await buscarResumoDias(7);
    const usuarios = await buscarUsuariosElegiveis(3, 4, "D3", true);

    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `⚽ ${wr}% de win rate — veja os greens do Mycroft esta semana`,
        html: html(u.full_name, wr, greens),
        text: `${u.primeiro_nome}, seu trial está no 3º dia. O Mycroft teve ${wr}% de win rate esta semana. Acesse: ${SITE_URL}/punter`,
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
