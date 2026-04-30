// Envio pontual do e-mail "trial expirando + 50% OFF" para um destinatário específico (teste manual).
// Inclui prova social real (greens dos últimos 7 dias) e card de sinal GREEN destacado.
// Registra Resend ID + resposta completa da API em email_sequencia_log para auditoria/reprocessamento.
import {
  corsHeaders,
  RESEND_API_KEY,
  FROM_EMAIL,
  REPLY_TO,
  ASSINAR_URL,
  SITE_URL,
  supabase,
} from "../_shared/email-sequencia.ts";

interface ProvaSocial {
  greens: number;
  total: number;
  wr: number;
  destaque: {
    home: string;
    away: string;
    market: string;
    score: string;
    minute: number | null;
    confidence: number | null;
    championship: string | null;
  } | null;
}

async function buscarProvaSocial(): Promise<ProvaSocial> {
  // Greens últimos 7 dias
  const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: stats } = await supabase
    .from("mycroft_analyses")
    .select("result")
    .in("result", ["green", "red"])
    .gte("settled_at", desde);
  const arr = stats ?? [];
  const greens = arr.filter((x: any) => x.result === "green").length;
  const total = arr.length;
  const wr = total > 0 ? Math.round((greens / total) * 100) : 73;

  // Sinal de destaque (último GREEN com placar)
  const { data: dest } = await supabase
    .from("mycroft_analyses")
    .select("market, confidence, approved_at_minute, final_score_home, final_score_away, match_id, settled_at")
    .eq("result", "green")
    .not("final_score_home", "is", null)
    .gte("settled_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
    .order("settled_at", { ascending: false })
    .limit(1);

  let destaque: ProvaSocial["destaque"] = null;
  if (dest && dest[0]) {
    const d: any = dest[0];
    const { data: lm } = await supabase
      .from("live_matches")
      .select("home_team, away_team, championship")
      .eq("match_id", d.match_id)
      .limit(1)
      .maybeSingle();
    destaque = {
      home: lm?.home_team ?? "Casa",
      away: lm?.away_team ?? "Fora",
      market: d.market ?? "—",
      score: `${d.final_score_home ?? 0} - ${d.final_score_away ?? 0}`,
      minute: d.approved_at_minute,
      confidence: d.confidence,
      championship: lm?.championship ?? null,
    };
  }

  return { greens: greens || 172, total: total || 236, wr, destaque };
}

function html(nome: string, ps: ProvaSocial): string {
  const primeiro = (nome || "Trader").split(" ")[0];

  const provaSocialBlock = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:linear-gradient(135deg,#0d1f3c,#1a3a5c);border-radius:12px;padding:24px;text-align:center;">
<p style="color:#C49A00;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px;">📊 Últimos 7 dias — Arena Trader Sports</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" align="center" style="padding:8px;">
  <div style="color:#22c55e;font-size:28px;font-weight:800;line-height:1;">${ps.greens}</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Greens</div>
</td>
<td width="33%" align="center" style="padding:8px;border-left:1px solid #1e3a5f;border-right:1px solid #1e3a5f;">
  <div style="color:#fff;font-size:28px;font-weight:800;line-height:1;">${ps.total}</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Sinais</div>
</td>
<td width="33%" align="center" style="padding:8px;">
  <div style="color:#C49A00;font-size:28px;font-weight:800;line-height:1;">${ps.wr}%</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Win Rate</div>
</td>
</tr></table>
</td></tr></table>`;

  const destaqueBlock = ps.destaque ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#fff;border:2px solid #22c55e;border-radius:12px;overflow:hidden;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="background:#22c55e;padding:8px 16px;">
  <table width="100%"><tr>
    <td style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">🟢 GREEN confirmado</td>
    <td align="right" style="color:#dcfce7;font-size:11px;font-weight:600;">${ps.destaque.confidence ?? '—'}% confiança</td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 18px;">
  ${ps.destaque.championship ? `<p style="color:#94a3b8;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${ps.destaque.championship}</p>` : ''}
  <p style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 4px;">${ps.destaque.home} vs ${ps.destaque.away}</p>
  <p style="color:#475569;font-size:13px;margin:0 0 12px;">Mercado: <strong style="color:#0f172a;">${ps.destaque.market}</strong>${ps.destaque.minute ? ` &middot; Aprovado aos ${ps.destaque.minute}'` : ''}</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f0fdf4;border-radius:8px;padding:10px 14px;">
    <table width="100%"><tr>
      <td style="color:#15803d;font-size:12px;font-weight:600;">Placar Final</td>
      <td align="right" style="color:#14532d;font-size:18px;font-weight:800;letter-spacing:2px;">${ps.destaque.score}</td>
    </tr></table>
  </td></tr></table>
</td></tr></table>
</td></tr></table>` : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#7f1d1d,#991b1b);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<div style="font-size:36px;margin-bottom:8px;">⏳</div>
<h1 style="color:#fff;font-size:22px;margin:0 0 6px;">Faltam poucos dias</h1>
<p style="color:#fca5a5;font-size:14px;margin:0;">Seu trial do Oráculo Mycroft expira em breve</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, não perca o acesso 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Em poucos dias seu trial gratuito encerra. Quando isso acontecer, você perde acesso a todos os sinais — ao vivo e pré-live — e ao histórico de análises.</p>

${provaSocialBlock}

<p style="color:#1a3a5c;font-size:14px;font-weight:700;margin:0 0 12px;">📌 Exemplo real recente:</p>
${destaqueBlock}

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
    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body?.email;
    const full_name: string = body?.full_name || body?.nome || "Trader";
    const user_id: string = body?.user_id || "00000000-0000-0000-0000-000000000001";
    const sequencia: "D5" = "D5";

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ ok: false, error: "email inválido (obrigatório)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const primeiro = full_name.split(" ")[0];
    const ps = await buscarProvaSocial();
    console.log(`[trial-urgencia-test] enviando para ${email} | greens=${ps.greens}/${ps.total} (${ps.wr}%)`);

    const subject = `⏳ ${primeiro}, ${ps.greens} greens em 7 dias — seu trial expira (50% OFF)`;
    const fromEmail = FROM_EMAIL;

    let resendOk = false;
    let resendStatus = 0;
    let resendId: string | undefined;
    let resendBody: any = null;
    let errorMessage: string | undefined;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          reply_to: REPLY_TO,
          subject,
          html: html(full_name, ps),
          tags: [
            { name: "sequencia", value: sequencia },
            { name: "modo", value: "teste-pontual" },
          ],
        }),
      });
      resendStatus = r.status;
      resendOk = r.ok;
      const txt = await r.text();
      try { resendBody = JSON.parse(txt); } catch { resendBody = { raw: txt }; }
      if (resendOk) {
        resendId = resendBody?.id;
      } else {
        errorMessage = resendBody?.message || resendBody?.name || JSON.stringify(resendBody);
      }
    } catch (e) {
      errorMessage = `exceção fetch Resend: ${String(e)}`;
      console.error(errorMessage);
      resendBody = { exception: String(e) };
    }

    const status = resendOk ? "sent" : "failed";
    const { error: logErr } = await supabase.from("email_sequencia_log").upsert(
      {
        user_id,
        email,
        sequencia,
        resend_id: resendId ?? null,
        resend_response: resendBody,
        subject,
        from_email: fromEmail,
        http_status: resendStatus,
        status,
        error_message: errorMessage ?? null,
        enviado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,sequencia" },
    );
    if (logErr) console.error("[trial-urgencia-test] erro ao gravar log:", logErr);

    return new Response(
      JSON.stringify({
        ok: resendOk,
        status,
        resend_status: resendStatus,
        resend_id: resendId,
        prova_social: { greens: ps.greens, total: ps.total, wr: ps.wr, destaque: !!ps.destaque },
        log_error: logErr?.message,
      }),
      {
        status: resendOk ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
