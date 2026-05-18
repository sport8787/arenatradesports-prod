// ═══════════════════════════════════════════════════════════════
// MYCROFT PUNTER ANALYTIC — Sherlock dedicado (sob demanda)
// ───────────────────────────────────────────────────────────────
// Reanalisa um único jogo com foco nos indicadores estatísticos
// avançados (Sherlock): médias casa/fora, CV ofensivo/defensivo,
// saldo, vetos e bônus. NÃO chama IA — é determinístico, rápido
// e gera um relatório legível pra UI/Telegram.
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { smSearchTeam, getRecentFixturesSM } from "../_shared/sportmonks-af-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Helpers estatísticos ───────────────────────────────────────
function calcularCV(valores: number[]): number {
  if (valores.length < 2) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  if (media === 0) return 0;
  const variancia = valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / valores.length;
  return Math.sqrt(variancia) / media;
}

// Sportmonks-based: resolve team by name then fetch last 20 FT fixtures (AF-compatible shape)
async function fetchFixtures(teamName: string): Promise<any[]> {
  try {
    const team = await smSearchTeam(teamName);
    if (!team) {
      console.warn(`[sherlock] time não encontrado no Sportmonks: ${teamName}`);
      return [];
    }
    return await getRecentFixturesSM(team.id, 20);
  } catch (e) {
    console.warn(`[sherlock] fetchFixtures err: ${(e as Error).message}`);
    return [];
  }
}

function computeContext(fixtures: any[], teamId: number, ctx: "home" | "away") {
  const filtered = fixtures.filter((f: any) => {
    const isHome = f.teams?.home?.id === teamId;
    const isAway = f.teams?.away?.id === teamId;
    if (ctx === "home") return isHome && f.goals?.home !== null;
    return isAway && f.goals?.away !== null;
  }).slice(0, 15);

  if (filtered.length < 3) {
    return { mediaPro: 0, mediaContra: 0, cvPro: 0, cvContra: 0, n: filtered.length };
  }
  const golsPro = filtered.map((f: any) => ctx === "home" ? f.goals.home : f.goals.away);
  const golsContra = filtered.map((f: any) => ctx === "home" ? f.goals.away : f.goals.home);
  return {
    mediaPro: golsPro.reduce((a, b) => a + b, 0) / golsPro.length,
    mediaContra: golsContra.reduce((a, b) => a + b, 0) / golsContra.length,
    cvPro: calcularCV(golsPro),
    cvContra: calcularCV(golsContra),
    n: filtered.length,
  };
}

async function getOrComputeAdvancedStats(teamId: number, teamName: string, season: number) {
  const { data: cached } = await sb
    .from("team_advanced_stats")
    .select("*")
    .eq("team_id", teamId)
    .eq("season", season)
    .maybeSingle();

  const fresh = cached?.last_updated &&
    (Date.now() - new Date(cached.last_updated).getTime()) < 24 * 60 * 60 * 1000;
  if (fresh) return cached;

  const fixtures = await fetchFixtures(teamName);
  if (fixtures.length < 3) return cached || null;

  const home = computeContext(fixtures, teamId, "home");
  const away = computeContext(fixtures, teamId, "away");
  const row = {
    team_id: teamId,
    season,
    team_name: teamName,
    home_avg_goals_scored: +home.mediaPro.toFixed(2),
    home_avg_goals_conceded: +home.mediaContra.toFixed(2),
    home_cv_scored: +home.cvPro.toFixed(2),
    home_cv_conceded: +home.cvContra.toFixed(2),
    away_avg_goals_scored: +away.mediaPro.toFixed(2),
    away_avg_goals_conceded: +away.mediaContra.toFixed(2),
    away_cv_scored: +away.cvPro.toFixed(2),
    away_cv_conceded: +away.cvContra.toFixed(2),
    sample_size: fixtures.length,
    last_updated: new Date().toISOString(),
  };
  await sb.from("team_advanced_stats").upsert(row, { onConflict: "team_id,season" });
  return row;
}

// ─── Engine Sherlock ────────────────────────────────────────────
function buildSherlockReport(market: string, planName: string, homeStats: any, awayStats: any) {
  const notes: string[] = [];
  const vetos: string[] = [];
  const bonus: string[] = [];
  let confidenceDelta = 0;
  const m = (market || "").toLowerCase();
  const plan = (planName || "").toUpperCase();
  const isLayGoleada = plan.includes("LAY_GOLEADA") || m.includes("lay goleada");

  if (homeStats) {
    const saldoHome = homeStats.home_avg_goals_scored - homeStats.home_avg_goals_conceded;
    notes.push(`🏠 Mandante (n=${homeStats.sample_size ?? "?"}): média ${homeStats.home_avg_goals_scored} pró / ${homeStats.home_avg_goals_conceded} contra | saldo ${saldoHome.toFixed(2)} | CV pró ${homeStats.home_cv_scored} / contra ${homeStats.home_cv_conceded}`);

    if (isLayGoleada && saldoHome > 1.2) {
      vetos.push(`🚫 LAY GOLEADA bloqueado: saldo médio do mandante ${saldoHome.toFixed(2)} > 1.20 (alta propensão a goleada).`);
    }
    if (isLayGoleada && (homeStats.home_cv_scored > 1.0 || homeStats.home_cv_conceded > 1.0)) {
      vetos.push(`🚫 LAY GOLEADA bloqueado: mandante inconsistente (CV ofensivo ${homeStats.home_cv_scored} / defensivo ${homeStats.home_cv_conceded}).`);
    }
    if (homeStats.home_cv_scored > 1.0 || homeStats.home_cv_conceded > 1.0) {
      notes.push(`⚠️ Mandante imprevisível (CV pró ${homeStats.home_cv_scored} / contra ${homeStats.home_cv_conceded})`);
      confidenceDelta -= 5;
    }
    if (m.includes("over 2.5") && homeStats.home_cv_scored < 0.5 && homeStats.home_avg_goals_scored > 1.5) {
      bonus.push(`✅ Mandante consistente ofensivo (CV ${homeStats.home_cv_scored}, média ${homeStats.home_avg_goals_scored}) → +5pp Over 2.5`);
      confidenceDelta += 5;
    }
    if (m.includes("under 2.5") && homeStats.home_cv_conceded < 0.6 && homeStats.home_avg_goals_conceded < 1.0) {
      bonus.push(`✅ Mandante defensivo consistente (CV ${homeStats.home_cv_conceded}, sofridos ${homeStats.home_avg_goals_conceded}) → +3pp Under 2.5`);
      confidenceDelta += 3;
    }
  }

  if (awayStats) {
    const saldoAway = awayStats.away_avg_goals_scored - awayStats.away_avg_goals_conceded;
    notes.push(`🚩 Visitante (n=${awayStats.sample_size ?? "?"}): média ${awayStats.away_avg_goals_scored} pró / ${awayStats.away_avg_goals_conceded} contra | saldo ${saldoAway.toFixed(2)} | CV pró ${awayStats.away_cv_scored} / contra ${awayStats.away_cv_conceded}`);

    if (awayStats.away_cv_scored > 1.0 || awayStats.away_cv_conceded > 1.0) {
      notes.push(`⚠️ Visitante imprevisível (CV pró ${awayStats.away_cv_scored} / contra ${awayStats.away_cv_conceded})`);
      confidenceDelta -= 5;
    }
    if (m.includes("under 2.5") && awayStats.away_cv_conceded < 0.6 && awayStats.away_avg_goals_conceded < 1.0) {
      bonus.push(`✅ Visitante defensivo consistente (CV ${awayStats.away_cv_conceded}, sofridos ${awayStats.away_avg_goals_conceded}) → +2pp Under 2.5`);
      confidenceDelta += 2;
    }
  }

  return {
    veto: vetos.length > 0,
    veto_reason: vetos[0] ?? null,
    confidence_delta: confidenceDelta,
    notes,
    bonus,
    vetos,
  };
}

// ─── Handler ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      home_team,
      away_team,
      home_id,
      away_id,
      season,
      market = "",
      plan_name = "",
      analysis_id = null,
      user_id = null,
    } = body || {};

    if (!home_team || !away_team) {
      return new Response(JSON.stringify({ error: "home_team e away_team são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seasonYear = Number(season) || new Date().getFullYear();
    let homeStats: any = null;
    let awayStats: any = null;

    if (home_id) homeStats = await getOrComputeAdvancedStats(Number(home_id), home_team, seasonYear);
    if (away_id) awayStats = await getOrComputeAdvancedStats(Number(away_id), away_team, seasonYear);

    // Fallback: se não passaram IDs, tenta achar no cache pelo nome
    if (!homeStats) {
      const { data } = await sb.from("team_advanced_stats").select("*").eq("team_name", home_team).eq("season", seasonYear).maybeSingle();
      homeStats = data;
    }
    if (!awayStats) {
      const { data } = await sb.from("team_advanced_stats").select("*").eq("team_name", away_team).eq("season", seasonYear).maybeSingle();
      awayStats = data;
    }

    const report = buildSherlockReport(market, plan_name, homeStats, awayStats);

    // Se vier analysis_id, atualiza o registro com os achados
    if (analysis_id && report.veto) {
      await sb.from("punter_analyses").update({
        verdict: "VETADO",
        veto_reason: report.veto_reason,
      }).eq("id", analysis_id);
    }

    // Auditoria: grava cada execução sob demanda
    let audit_id: string | null = null;
    try {
      const { data: auditRow } = await sb.from("sherlock_audit_log").insert({
        user_id: user_id ?? null,
        analysis_id: analysis_id ?? null,
        home_team,
        away_team,
        home_id: home_id ?? null,
        away_id: away_id ?? null,
        season: seasonYear,
        market,
        plan_name,
        veto: report.veto,
        veto_reason: report.veto_reason,
        confidence_delta: report.confidence_delta,
        notes: report.notes,
        bonus: report.bonus,
        vetos: report.vetos,
        home_stats: homeStats,
        away_stats: awayStats,
        request_payload: body,
      }).select("id").single();
      audit_id = auditRow?.id ?? null;
    } catch (e) {
      console.warn("[sherlock] falha ao gravar auditoria:", (e as Error).message);
    }

    return new Response(JSON.stringify({
      ok: true,
      home_team,
      away_team,
      market,
      plan_name,
      home_stats: homeStats,
      away_stats: awayStats,
      report,
      audit_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
