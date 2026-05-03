// Daily Recap Email — envia para cada usuário ativo um resumo do dia anterior:
// sinais aprovados, GREEN/RED, ROI virtual, BluffCoins ganhos, e CTA Loja BC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Oráculo Mycroft <mycroft@oraculo-mycroft.com>";
const SITE_URL = "https://oraculo-mycroft.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SVC_KEY);

interface UserStats {
  user_id: string;
  email: string;
  username: string;
  greens: number;
  reds: number;
  pendentes: number;
  bc_ganho: number;
  bc_total: number;
  roi_pct: number;
}

async function buildStatsForYesterday(): Promise<UserStats[]> {
  const yesterdayStart = new Date();
  yesterdayStart.setUTCHours(0, 0, 0, 0);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1);

  // Pega assinaturas ativas (trial, premium, etc.)
  const { data: subs } = await supabase
    .from("user_subscriptions")
    .select("user_id, is_active")
    .eq("is_active", true);
  if (!subs?.length) return [];

  const userIds = subs.map((s: any) => s.user_id);

  // Profiles + emails
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, bc_balance")
    .in("user_id", userIds);

  // Auth users — emails
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailMap = new Map<string, string>();
  for (const u of authUsers || []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  // Bets de ontem (Hórus + manual)
  const [{ data: vbp }, { data: vbm }, { data: bcLog }] = await Promise.all([
    supabase
      .from("virtual_bets_punter")
      .select("user_id, status, result, stake, profit_loss")
      .gte("updated_at", yesterdayStart.toISOString())
      .lt("updated_at", yesterdayEnd.toISOString()),
    supabase
      .from("virtual_bets_manual")
      .select("user_id, status, result, stake, profit_loss")
      .gte("updated_at", yesterdayStart.toISOString())
      .lt("updated_at", yesterdayEnd.toISOString()),
    supabase
      .from("bc_rewards_log")
      .select("user_id, total_bc")
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", yesterdayEnd.toISOString()),
  ]);

  const allBets = [...(vbp || []), ...(vbm || [])];
  const stats = new Map<string, UserStats>();

  for (const p of profiles || []) {
    const email = emailMap.get(p.user_id);
    if (!email) continue;
    stats.set(p.user_id, {
      user_id: p.user_id,
      email,
      username: p.username || "Trader",
      greens: 0, reds: 0, pendentes: 0,
      bc_ganho: 0, bc_total: p.bc_balance || 0,
      roi_pct: 0,
    });
  }

  let stakeTotal = new Map<string, number>();
  let plTotal = new Map<string, number>();

  for (const b of allBets) {
    const s = stats.get(b.user_id);
    if (!s) continue;
    const r = String(b.result || "").toLowerCase();
    if (r === "won" || r === "green" || r === "win") s.greens++;
    else if (r === "lost" || r === "red" || r === "loss") s.reds++;
    else if (b.status === "pending") s.pendentes++;
    stakeTotal.set(b.user_id, (stakeTotal.get(b.user_id) || 0) + Number(b.stake || 0));
    plTotal.set(b.user_id, (plTotal.get(b.user_id) || 0) + Number(b.profit_loss || 0));
  }

  for (const r of bcLog || []) {
    const s = stats.get(r.user_id);
    if (s) s.bc_ganho += Number(r.total_bc || 0);
  }

  for (const s of stats.values()) {
    const stake = stakeTotal.get(s.user_id) || 0;
    const pl = plTotal.get(s.user_id) || 0;
    s.roi_pct = stake > 0 ? Math.round((pl / stake) * 1000) / 10 : 0;
  }

  // Só envia para quem teve algum sinal ou BC no dia
  return [...stats.values()].filter(
    (s) => s.greens + s.reds + s.pendentes > 0 || s.bc_ganho > 0,
  );
}

function htmlFor(s: UserStats): string {
  const totalBets = s.greens + s.reds;
  const winRate = totalBets > 0 ? Math.round((s.greens / totalBets) * 100) : 0;
  const roiColor = s.roi_pct >= 0 ? "#10b981" : "#ef4444";
  const roiSign = s.roi_pct >= 0 ? "+" : "";
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#0a0e1a;color:#e7eaf2;margin:0;padding:0;">
<table width="100%" bgcolor="#0a0e1a" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table width="600" bgcolor="#121826" cellpadding="0" cellspacing="0" style="max-width:600px;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
<tr><td style="padding:28px 28px 8px;">
<h1 style="color:#fbbf24;font-size:22px;margin:0 0 4px;">📊 Resumo de ontem, ${s.username.split(" ")[0]}</h1>
<p style="color:#9ca3af;font-size:14px;margin:0;">O Mycroft fechou as contas. Aqui está sua noite.</p>
</td></tr>
<tr><td style="padding:20px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a2235;border-radius:12px;">
<tr>
<td align="center" style="padding:18px 8px;border-right:1px solid #1f2937;">
<div style="color:#10b981;font-size:24px;font-weight:700;">${s.greens}</div>
<div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">GREEN</div>
</td>
<td align="center" style="padding:18px 8px;border-right:1px solid #1f2937;">
<div style="color:#ef4444;font-size:24px;font-weight:700;">${s.reds}</div>
<div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">RED</div>
</td>
<td align="center" style="padding:18px 8px;border-right:1px solid #1f2937;">
<div style="color:#e7eaf2;font-size:24px;font-weight:700;">${winRate}%</div>
<div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Acerto</div>
</td>
<td align="center" style="padding:18px 8px;">
<div style="color:${roiColor};font-size:24px;font-weight:700;">${roiSign}${s.roi_pct}%</div>
<div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">ROI</div>
</td>
</tr>
</table>
${s.bc_ganho > 0 ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);border-radius:12px;">
<tr><td align="center" style="padding:16px;">
<div style="color:#0a0e1a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">🪙 BluffCoins ganhos ontem</div>
<div style="color:#0a0e1a;font-size:32px;font-weight:800;margin-top:4px;">+${s.bc_ganho.toLocaleString("pt-BR")} BC</div>
<div style="color:#1a2235;font-size:12px;margin-top:2px;">Saldo total: ${s.bc_total.toLocaleString("pt-BR")} BC</div>
</td></tr></table>` : ""}
${s.pendentes > 0 ? `
<p style="color:#9ca3af;font-size:13px;margin:14px 0 0;">⏳ Você ainda tem <strong style="color:#fbbf24;">${s.pendentes} aposta(s) pendente(s)</strong> aguardando liquidação.</p>` : ""}
</td></tr>
<tr><td align="center" style="padding:8px 28px 28px;">
<a href="${SITE_URL}/punter" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;margin:6px 4px;">🎯 Ver sinais de hoje</a>
${s.bc_total >= 50000 ? `<a href="${SITE_URL}/loja-bc" style="display:inline-block;background:#fbbf24;color:#0a0e1a;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;margin:6px 4px;">🪙 Trocar BC por prêmios</a>` : `<a href="${SITE_URL}/loja-bc" style="display:inline-block;background:transparent;color:#fbbf24;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;border:1px solid #fbbf24;margin:6px 4px;">🪙 Ver Loja BC</a>`}
</td></tr>
<tr><td style="padding:0 28px 24px;">
<p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;text-align:center;">Você recebe este resumo porque tem assinatura ativa no Oráculo Mycroft. <a href="${SITE_URL}/punter/config" style="color:#9ca3af;">Ajustar preferências</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function enviarRecap(s: UserStats): Promise<boolean> {
  try {
    const subject = s.greens > s.reds
      ? `🟢 ${s.greens}V x ${s.reds}D ontem · +${s.bc_ganho} BC`
      : s.bc_ganho > 0
      ? `🪙 +${s.bc_ganho} BC ontem · resumo Mycroft`
      : `📊 Resumo Mycroft de ontem (${s.greens}V x ${s.reds}D)`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        reply_to: "israel@oraculo-mycroft.com",
        to: [s.email],
        subject,
        html: htmlFor(s),
        tags: [{ name: "sequencia", value: "DAILY_RECAP" }, { name: "user_id", value: s.user_id }],
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("recap erro", s.email, e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stats = await buildStatsForYesterday();
    let sent = 0, failed = 0;
    for (const s of stats) {
      const ok = await enviarRecap(s);
      if (ok) sent++; else failed++;
      await new Promise((r) => setTimeout(r, 80)); // 80ms anti-burst
    }
    return new Response(JSON.stringify({ ok: true, candidates: stats.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
