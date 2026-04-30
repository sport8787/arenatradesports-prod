// E-mail D5 — Urgência (5 dias após cadastro, não-assinantes)
import {
  buscarUsuariosElegiveis,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  SITE_URL,
  ASSINAR_URL,
} from "../_shared/email-sequencia.ts";

function html(nome: string): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#7f1d1d,#991b1b);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<div style="font-size:36px;margin-bottom:8px;">⏳</div>
<h1 style="color:#fff;font-size:22px;margin:0 0 6px;">Faltam 2 dias</h1>
<p style="color:#fca5a5;font-size:14px;margin:0;">Seu trial do Oráculo Mycroft expira em breve</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, não perca o acesso 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Em 2 dias seu trial gratuito encerra. Quando isso acontecer, você perde acesso a todos os sinais — ao vivo e pré-live — e ao histórico de análises.</p>
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
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#f8f9fc;border-radius:12px;padding:20px;">
<p style="color:#555;font-size:13px;font-style:italic;line-height:1.7;margin:0 0 8px;">"Tenho 10 anos de experiência em trading esportivo e já usei todas as principais ferramentas do mercado. No final escolhi o Mycroft. Não tem produto melhor disponível hoje."</p>
<p style="color:#1a3a5c;font-size:13px;font-weight:600;margin:0;">— Paulo, trader profissional com 10 anos de experiência</p>
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
    const usuarios = await buscarUsuariosElegiveis(5, 6, "D5", true);
    let enviados = 0, erros = 0;
    for (const u of usuarios) {
      const r = await enviarResend({
        to: u.email,
        subject: `⏳ ${u.primeiro_nome}, faltam 2 dias para seu trial expirar`,
        html: html(u.full_name),
        text: `${u.primeiro_nome}, faltam 2 dias para seu trial do Oráculo Mycroft expirar. Garanta 50% OFF antes que acabe: ${ASSINAR_URL}`,
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
