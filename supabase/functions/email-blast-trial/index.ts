// Disparo em massa: D5 (urgência) para TODOS trials ativos + EXPIRADO para quem expirou nos últimos 15 dias.
// Respeita email_sequencia_log (onConflict user_id,sequencia) para não duplicar.
import {
  supabase,
  enviarResend,
  registrarEnvio,
  corsHeaders,
  ASSINAR_URL,
  FROM_EMAIL_PESSOAL,
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

// Reaproveita HTML do D5
function htmlD5(nome: string, ps: ProvaSocial): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  const body = `
<h2 style="color:#1a3a5c;font-size:20px;margin:0 0 14px;">${primeiro}, seu trial está acabando 🔮</h2>
<p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">Seu trial gratuito do Oráculo Mycroft está perto de encerrar. Quando isso acontecer, o desconto de <strong>50% OFF expira junto</strong> — e você perde acesso a todos os sinais ao vivo, pré-live e ao histórico.</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#fff5f5;border:1px solid #fecaca;border-radius:12px;padding:20px;">
<p style="color:#991b1b;font-size:14px;font-weight:700;margin:0 0 10px;">❌ O que você perde ao expirar:</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Arena Trader Sports — sinais ao vivo com IA</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Mycroft Punter — sinais pré-live com Value Expected</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Plano Favorito + Handicap Asiático + Eventos Raros</p>
<p style="color:#7f1d1d;font-size:13px;margin:5px 0;">• Lives semanais e Grupo VIP no Telegram</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;">
<p style="color:#14532d;font-size:14px;font-weight:700;margin:0 0 10px;">✅ Assinando agora você garante:</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Acesso contínuo sem interrupção</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Todo o histórico e resultados preservados</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• <strong>50% OFF exclusivo</strong> antes do trial expirar</p>
<p style="color:#15803d;font-size:13px;margin:5px 0;">• Cancele quando quiser. Sem fidelidade.</p>
</td></tr></table>

${botaoCTA(ASSINAR_URL, "🔐 Garantir 50% OFF agora")}
<p style="color:#888;font-size:12px;text-align:center;margin:0 0 16px;">Cancele quando quiser. Sem fidelidade.</p>`;
  return emailLayout({
    headerGradient: "#7f1d1d,#991b1b",
    headerEmoji: "⏳",
    headerTitle: "Seu trial está acabando",
    headerSubtitle: "50% OFF expira junto com o trial",
    bodyHtml: body,
  });
}

function htmlExpirado(nome: string, ps: ProvaSocial): string {
  const primeiro = nome.split(" ")[0] || "Trader";
  const body = `
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 16px;">Olá, <strong>${primeiro}</strong>.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 16px;">Sou o Israel, CEO do Oráculo Mycroft. Percebi que seu trial encerrou e queria te escrever pessoalmente.</p>
<p style="color:#444;font-size:15px;line-height:1.8;margin:0 0 24px;">Antes de você decidir, dá uma olhada no que o sistema entregou enquanto você esteve fora:</p>

${blocoProvaSocial(ps)}
${blocoCardDestaque(ps)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="background:#f0f6ff;border-left:4px solid #1a3a5c;padding:18px 20px;border-radius:0 10px 10px 0;">
<p style="color:#1a3a5c;font-size:15px;font-weight:700;margin:0 0 8px;">Posso te perguntar algo?</p>
<p style="color:#444;font-size:13px;line-height:1.7;margin:0;">O que faltou durante o trial? O sistema não era o que esperava? O preço não fez sentido? Faltou tempo para testar?</p>
<p style="color:#444;font-size:13px;line-height:1.7;margin:8px 0 0;">Responde esse e-mail com a sua opinião honesta — eu leio e respondo pessoalmente.</p>
</td></tr></table>

${botaoCTA(ASSINAR_URL, "Reativar com 50% OFF")}
<p style="color:#888;font-size:12px;text-align:center;margin:0 0 20px;">Acesso imediato. Sem fidelidade. Cancela quando quiser.</p>

<p style="color:#444;font-size:13px;line-height:1.7;margin:0;">Independente da sua decisão, obrigado por ter testado o Mycroft.</p>`;
  return emailLayout({
    headerGradient: "#1a3a5c,#0d1f3c",
    headerEmoji: "✉️",
    headerTitle: "Uma mensagem pessoal",
    headerSubtitle: "Israel Fideles — CEO Oráculo Mycroft",
    bodyHtml: body,
  });
}

async function carregarUsuarios(filtro: "ativos" | "expirados"): Promise<UsuarioAlvo[]> {
  const agora = new Date().toISOString();
  const limiteExpirado = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();

  let q = supabase.from("user_subscriptions").select("user_id, trial_ends_at, plan, is_active").eq("plan", "trial");
  if (filtro === "ativos") {
    q = q.eq("is_active", true).gt("trial_ends_at", agora);
  } else {
    q = q.lt("trial_ends_at", agora).gt("trial_ends_at", limiteExpirado);
  }
  const { data: subs } = await q;
  if (!subs?.length) return [];

  const alvos: UsuarioAlvo[] = [];
  for (const s of subs) {
    const { data: u } = await supabase.auth.admin.getUserById(s.user_id);
    const email = u?.user?.email;
    if (!email) continue;
    const fullName = (u.user.user_metadata as any)?.full_name || (u.user.user_metadata as any)?.name || email.split("@")[0];
    alvos.push({ user_id: s.user_id, email, full_name: fullName, primeiro_nome: String(fullName).split(" ")[0] });
  }
  return alvos;
}

async function jaEnviou(userId: string, sequencia: "D5" | "EXPIRADO"): Promise<boolean> {
  const { data } = await supabase
    .from("email_sequencia_log")
    .select("id, status")
    .eq("user_id", userId)
    .eq("sequencia", sequencia)
    .maybeSingle();
  return !!(data && data.status === "sent");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    const ps = await buscarProvaSocial(7);

    const ativos = await carregarUsuarios("ativos");
    const expirados = await carregarUsuarios("expirados");

    const stats = { d5_enviados: 0, d5_pulados: 0, d5_erros: 0, exp_enviados: 0, exp_pulados: 0, exp_erros: 0 };

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, ativos: ativos.length, expirados: expirados.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // D5 — trials ativos
    for (const u of ativos) {
      if (await jaEnviou(u.user_id, "D5")) { stats.d5_pulados++; continue; }
      const r = await enviarResend({
        to: u.email,
        subject: `⏳ ${u.primeiro_nome}, seu trial está acabando — 50% OFF expira junto`,
        html: htmlD5(u.full_name, ps),
        text: `${u.primeiro_nome}, seu trial está acabando. ${ps.greens} greens em 7 dias (${ps.wr}% WR). Garanta 50% OFF: ${ASSINAR_URL}`,
        sequencia: "D5",
        userId: u.user_id,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "D5", r.id); stats.d5_enviados++; }
      else { await registrarEnvio(u.user_id, u.email, "D5", undefined, "failed", String(r.error)); stats.d5_erros++; }
      await new Promise(res => setTimeout(res, 200));
    }

    // EXPIRADO — trials encerrados nos últimos 15 dias
    for (const u of expirados) {
      if (await jaEnviou(u.user_id, "EXPIRADO")) { stats.exp_pulados++; continue; }
      const r = await enviarResend({
        to: u.email,
        subject: `${u.primeiro_nome}, uma pergunta rápida sobre seu trial`,
        html: htmlExpirado(u.full_name, ps),
        text: `Olá ${u.primeiro_nome}, sou o Israel. ${ps.greens} greens em 7 dias enquanto você esteve fora. Reativar com 50% OFF: ${ASSINAR_URL}`,
        sequencia: "EXPIRADO",
        userId: u.user_id,
        from: FROM_EMAIL_PESSOAL,
      });
      if (r.ok) { await registrarEnvio(u.user_id, u.email, "EXPIRADO", r.id); stats.exp_enviados++; }
      else { await registrarEnvio(u.user_id, u.email, "EXPIRADO", undefined, "failed", String(r.error)); stats.exp_erros++; }
      await new Promise(res => setTimeout(res, 200));
    }

    return new Response(JSON.stringify({ success: true, ativos: ativos.length, expirados: expirados.length, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
