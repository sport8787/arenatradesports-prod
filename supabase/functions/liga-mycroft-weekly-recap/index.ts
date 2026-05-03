// Edge Function: liga-mycroft-weekly-recap
// Cron: domingo 14h UTC (11h BRT)
// Envia email semanal para usuários ativos com:
//  - Posição no ranking Liga Mycroft (ROI%)
//  - BluffCoins acumulados na semana
//  - Mercado mais rentável da semana
//  - CTA Liga Mycroft

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Oráculo Mycroft <mycroft@oraculo-mycroft.com>";
const SITE_URL = "https://oraculo-mycroft.com";

const supabase = createClient(SUPABASE_URL, SVC_KEY);

interface UserRecap {
  user_id: string;
  email: string;
  username: string;
  ranking_position: number | null;
  ranking_total: number;
  roi_pct: number | null;
  bc_week: number;
  bc_total: number;
  best_market: string | null;
  best_market_roi: number;
}

function weekRange(): { start: string; end: string; startLabel: string; endLabel: string } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 7);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startLabel: start.toLocaleDateString("pt-BR"),
    endLabel: new Date(end.getTime() - 1).toLocaleDateString("pt-BR"),
  };
}

async function buildRecaps(): Promise<UserRecap[]> {
  const { start, end } = weekRange();

  // 1. Usuários com assinatura ativa
  const { data: subs } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("is_active", true);
  const userIds = (subs ?? []).map((s: any) => s.user_id);
  if (!userIds.length) return [];

  // 2. Profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, bc_balance")
    .in("user_id", userIds);

  // 3. Auth emails
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map<string, string>();
  for (const u of authUsers || []) if (u.email) emailMap.set(u.id, u.email);

  // 4. Liga Mycroft ranking (ordenado por ROI%)
  const { data: ranking } = await supabase
    .from("liga_mycroft_leaderboard")
    .select("user_id, roi_pct")
    .order("roi_pct", { ascending: false });
  const rankMap = new Map<string, number>();
  (ranking ?? []).forEach((r: any, i: number) => rankMap.set(r.user_id, i + 1));
  const rankingTotal = ranking?.length ?? 0;

  // 5. BC ganho na semana
  const { data: bcLog } = await supabase
    .from("bc_rewards_log")
    .select("user_id, total_bc")
    .gte("created_at", start)
    .lt("created_at", end)
    .in("user_id", userIds);
  const bcWeekMap = new Map<string, number>();
  (bcLog ?? []).forEach((b: any) => bcWeekMap.set(b.user_id, (bcWeekMap.get(b.user_id) ?? 0) + Number(b.total_bc ?? 0)));

  // 6. Melhor mercado (top ROI por mercado, agregado de todos os usuários — usado como "dica")
  const [{ data: vbp }, { data: vbm }] = await Promise.all([
    supabase
      .from("virtual_bets_punter")
      .select("user_id, market, status, profit_loss, stake")
      .gte("updated_at", start)
      .lt("updated_at", end)
      .in("status", ["GREEN", "RED"]),
    supabase
      .from("virtual_bets_manual")
      .select("user_id, market, status, profit_loss, stake")
      .gte("updated_at", start)
      .lt("updated_at", end)
      .in("status", ["GREEN", "RED"]),
  ]);
  const bets = [...(vbp ?? []), ...(vbm ?? [])];

  // Best market por usuário
  const userMarketStats = new Map<string, Map<string, { profit: number; stake: number }>>();
  for (const b of bets) {
    if (!b.market) continue;
    if (!userMarketStats.has(b.user_id)) userMarketStats.set(b.user_id, new Map());
    const m = userMarketStats.get(b.user_id)!;
    const cur = m.get(b.market) ?? { profit: 0, stake: 0 };
    cur.profit += Number(b.profit_loss ?? 0);
    cur.stake += Number(b.stake ?? 0);
    m.set(b.market, cur);
  }

  const recaps: UserRecap[] = [];
  for (const p of profiles ?? []) {
    const email = emailMap.get(p.user_id);
    if (!email) continue;
    const bcWeek = bcWeekMap.get(p.user_id) ?? 0;
    const ranked = rankMap.get(p.user_id) ?? null;
    const userRoi = ranking?.find((r: any) => r.user_id === p.user_id)?.roi_pct ?? null;

    let bestMarket: string | null = null;
    let bestRoi = -Infinity;
    const m = userMarketStats.get(p.user_id);
    if (m) {
      for (const [market, st] of m.entries()) {
        if (st.stake < 50) continue; // ignora ruído
        const roi = (st.profit / st.stake) * 100;
        if (roi > bestRoi) { bestRoi = roi; bestMarket = market; }
      }
    }

    // Só envia se houve ATIVIDADE na semana (BC ganho ou aposta resolvida)
    if (bcWeek === 0 && !bestMarket) continue;

    recaps.push({
      user_id: p.user_id,
      email,
      username: p.username ?? email.split("@")[0],
      ranking_position: ranked,
      ranking_total: rankingTotal,
      roi_pct: userRoi != null ? Number(userRoi) : null,
      bc_week: bcWeek,
      bc_total: Number(p.bc_balance ?? 0),
      best_market: bestMarket,
      best_market_roi: bestRoi === -Infinity ? 0 : bestRoi,
    });
  }
  return recaps;
}

function renderEmail(r: UserRecap, period: { startLabel: string; endLabel: string }): { subject: string; html: string } {
  const positionBadge = r.ranking_position
    ? `<strong>#${r.ranking_position}</strong> de ${r.ranking_total} apostadores`
    : "ainda fora do ranking — bata 10 apostas para entrar";
  const roiLine = r.roi_pct != null ? `ROI da semana: <strong style="color:${r.roi_pct >= 0 ? "#16a34a" : "#dc2626"}">${r.roi_pct.toFixed(1)}%</strong>` : "";
  const marketBlock = r.best_market
    ? `<p style="margin:0 0 8px"><strong>📊 Mercado mais rentável da sua semana:</strong> ${r.best_market} (${r.best_market_roi.toFixed(1)}% de ROI)</p>
       <p style="margin:0;color:#64748b;font-size:13px">Considere reforçar este mercado nas próximas operações — Mycroft identificou um padrão favorável.</p>`
    : `<p style="margin:0;color:#64748b">Nenhum mercado consolidado ainda. Continue operando e o Mycroft vai destacar seu padrão favorito.</p>`;

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:0;margin:0">
<div style="max-width:560px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1628;padding:24px 28px">
    <h1 style="color:#fff;margin:0;font-size:22px">🏆 Sua semana na Liga Mycroft</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${period.startLabel} → ${period.endLabel}</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 20px;font-size:15px">Olá <strong>${r.username}</strong>,</p>

    <div style="background:#f1f5f9;border-left:4px solid #0a1628;padding:14px 18px;margin:0 0 18px;border-radius:4px">
      <p style="margin:0 0 6px;font-size:13px;color:#475569">POSIÇÃO ATUAL</p>
      <p style="margin:0;font-size:18px">${positionBadge}</p>
      ${roiLine ? `<p style="margin:6px 0 0;font-size:13px">${roiLine}</p>` : ""}
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;margin:0 0 18px;border-radius:4px">
      <p style="margin:0 0 6px;font-size:13px;color:#78350f">BLUFFCOINS</p>
      <p style="margin:0;font-size:16px">+<strong>${r.bc_week}</strong> esta semana · <strong>${r.bc_total}</strong> total</p>
    </div>

    <div style="background:#ecfdf5;border-left:4px solid #16a34a;padding:14px 18px;margin:0 0 24px;border-radius:4px">
      ${marketBlock}
    </div>

    <div style="text-align:center;margin:0 0 16px">
      <a href="${SITE_URL}/loja-bc" style="display:inline-block;background:#0a1628;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver Liga Mycroft completa</a>
    </div>

    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center">
      Você recebeu este email porque é assinante ativo do Oráculo Mycroft.<br>
      <a href="${SITE_URL}/punter/configuracoes" style="color:#94a3b8">Gerenciar notificações</a>
    </p>
  </div>
</div></body></html>`;

  const positionStr = r.ranking_position ? `#${r.ranking_position}` : "fora do ranking";
  const subject = `🏆 Liga Mycroft — você está em ${positionStr} (+${r.bc_week} BC esta semana)`;
  return { subject, html };
}

async function sendOne(to: string, subject: string, html: string): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) {
    console.warn(`[liga-recap] resend fail ${r.status} ${to}`, await r.text().catch(() => ""));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const period = weekRange();
    const recaps = await buildRecaps();
    console.log(`[liga-recap] ${recaps.length} usuários elegíveis`);

    let sent = 0, failed = 0;
    for (const r of recaps) {
      const { subject, html } = renderEmail(r, { startLabel: period.startLabel, endLabel: period.endLabel });
      const ok = await sendOne(r.email, subject, html);
      ok ? sent++ : failed++;
      // Throttle suave para não estourar limit Resend (10/s)
      await new Promise((res) => setTimeout(res, 120));
    }

    return new Response(JSON.stringify({ ok: true, eligible: recaps.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[liga-recap] error", err);
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
