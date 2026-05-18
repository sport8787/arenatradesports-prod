// =============================================================================
// SINAIS ALAVANCA — Under 4.5
// Scanner único com modos `live` e `prelive`.
// - prelive: roda 2x/dia (07h e 13h UTC) varrendo jogos NS de hoje/amanhã
// - live: roda a cada 3 min varrendo live_matches
// Critério principal: jogos com altíssima probabilidade de Under 4.5 gols.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const API_BASE = "https://v3.football.api-sports.io";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Ligas tipicamente mais defensivas / previsíveis para Under
const LIGAS_PERMITIDAS = [
  39, 40, 41, 78, 79, 135, 136, 140, 141, 61, 62, 71, 72, 73, 75, 76,
  88, 94, 144, 203, 207, 218, 253, 262, 281, 2, 3, 4, 5, 11, 13,
];

const SCORE_THRESHOLD = 70;

async function apiFootball(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API_BASE}${path}?${qs}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.response ?? [];
}

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function statsLiga(leagueId: number, season: number) {
  // Média de gols/jogo da liga via /fixtures/statistics não existe pública;
  // aproximamos com /standings ou simplesmente assumimos neutro.
  return null;
}

async function getOddUnder45(matchId: string): Promise<number | null> {
  const { data } = await sb
    .from("arena_odds")
    .select("odd_current")
    .eq("match_id", matchId)
    .ilike("market", "%under_4.5%")
    .order("timestamp_current", { ascending: false })
    .limit(1);
  if (data?.[0]?.odd_current) return Number(data[0].odd_current);
  // fallback API-Football odds
  return null;
}

function calcScorePrelive(opts: {
  mediaH2H: number;
  pctUnder45H2H: number;
  mediaGolsHome: number;
  mediaGolsAway: number;
  odd: number | null;
}) {
  const reasons: string[] = [];
  let score = 0;
  if (opts.mediaH2H > 0 && opts.mediaH2H <= 2.8) {
    score += 25;
    reasons.push(`Média H2H ${opts.mediaH2H.toFixed(2)} gols/jogo`);
  }
  const mediaTimes = (opts.mediaGolsHome + opts.mediaGolsAway) / 2;
  if (mediaTimes > 0 && mediaTimes <= 2.8) {
    score += 25;
    reasons.push(`Média recente dos times ${mediaTimes.toFixed(2)} gols`);
  }
  if (opts.pctUnder45H2H >= 85) {
    score += 20;
    reasons.push(`${opts.pctUnder45H2H.toFixed(0)}% dos H2H sob 4.5`);
  }
  if (opts.odd != null && opts.odd >= 1.06 && opts.odd <= 1.25) {
    score += 10;
    reasons.push(`Odd Under 4.5 @ ${opts.odd.toFixed(2)}`);
  } else if (opts.odd != null && (opts.odd < 1.04 || opts.odd > 1.35)) {
    return { score: 0, reasons: ['odd fora da faixa de alavanca'], veto: true };
  }
  // Vetos
  if (opts.mediaGolsHome > 2.0 && opts.mediaGolsAway > 2.0) {
    return { score: 0, reasons: ['ambos times com ataque > 2.0 gols/jogo'], veto: true };
  }
  return { score, reasons, veto: false };
}

function calcScoreLive(opts: {
  minute: number;
  goals: number;
  odd: number | null;
  xgTotal?: number | null;
}) {
  const reasons: string[] = [];
  let score = 0;
  if (opts.goals >= 4) return { score: 0, reasons: ['já marcou 4+ gols'], veto: true };
  if (opts.minute >= 30 && opts.goals >= 3) {
    return { score: 0, reasons: ['3 gols antes dos 30\' = risco real'], veto: true };
  }
  // 🚫 VETO xG: ritmo de alta voltagem inviabiliza Under 4.5
  if (opts.xgTotal != null && opts.xgTotal > 0 && opts.minute >= 20) {
    const projetado = opts.xgTotal * (90 / Math.max(opts.minute, 20));
    if (opts.xgTotal >= 2.5 || projetado >= 4.0) {
      return {
        score: 0,
        reasons: [`xG atual ${opts.xgTotal.toFixed(2)} (proj. ${projetado.toFixed(2)}) inviabiliza Under 4.5`],
        veto: true,
      };
    }
  }
  if (opts.minute >= 60 && opts.goals <= 2) {
    score += 50;
    reasons.push(`Min ${opts.minute}' com ${opts.goals} gols`);
  } else if (opts.minute >= 45 && opts.goals <= 1) {
    score += 40;
    reasons.push(`Intervalo com ${opts.goals} gol(s)`);
  } else if (opts.minute >= 30 && opts.goals === 0) {
    score += 30;
    reasons.push(`Min ${opts.minute}' ainda 0x0`);
  }
  if (opts.odd != null && opts.odd >= 1.04 && opts.odd <= 1.20) {
    score += 25;
    reasons.push(`Odd live Under 4.5 @ ${opts.odd.toFixed(2)}`);
  }
  if (opts.minute >= 75 && opts.goals <= 3) {
    score += 15;
    reasons.push(`Reta final (${opts.minute}') sob controle`);
  }
  // ✨ BOOST: xG baixo confirma jogo "amarrado"
  if (opts.xgTotal != null && opts.minute >= 30 && opts.xgTotal <= 1.0) {
    score += 10;
    reasons.push(`xG total ${opts.xgTotal.toFixed(2)} reforça baixa voltagem`);
  }
  return { score, reasons, veto: false };
}

async function runPrelive() {
  const hoje = new Date().toISOString().split("T")[0];
  const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [a, b] = await Promise.all([
    apiFootball("/fixtures", { date: hoje }),
    apiFootball("/fixtures", { date: amanha }),
  ]);
  const fixtures = [...a, ...b].filter((f: any) =>
    LIGAS_PERMITIDAS.includes(f.league.id) && f.fixture.status.short === "NS"
  );

  let inserted = 0;
  for (const f of fixtures.slice(0, 60)) {
    try {
      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;
      const leagueId = f.league.id;
      const season = f.league.season;

      const [h2h, statsHome, statsAway] = await Promise.all([
        apiFootball("/fixtures/headtohead", { h2h: `${homeId}-${awayId}`, last: 10 }),
        apiFootball("/teams/statistics", { team: homeId, league: leagueId, season }),
        apiFootball("/teams/statistics", { team: awayId, league: leagueId, season }),
      ]);

      const totaisH2H = (h2h || []).map((m: any) => (m.goals.home ?? 0) + (m.goals.away ?? 0));
      const mediaH2H = avg(totaisH2H);
      const under45H2H = totaisH2H.filter((t: number) => t <= 4).length;
      const pctUnder45 = totaisH2H.length ? (under45H2H / totaisH2H.length) * 100 : 0;

      const mediaGolsHome = Number(statsHome?.[0]?.goals?.for?.average?.total ?? 0);
      const mediaGolsAway = Number(statsAway?.[0]?.goals?.for?.average?.total ?? 0);

      const odd = await getOddUnder45(String(f.fixture.id));

      const { score, reasons, veto } = calcScorePrelive({
        mediaH2H, pctUnder45H2H: pctUnder45, mediaGolsHome, mediaGolsAway, odd,
      });

      if (veto || score < SCORE_THRESHOLD) continue;

      await sb.from("sinais_alavanca").upsert({
        match_id: String(f.fixture.id),
        match_name: `${f.teams.home.name} x ${f.teams.away.name}`,
        league: f.league.name,
        league_id: leagueId,
        kickoff: f.fixture.date,
        mode: 'prelive',
        score,
        odd_under45: odd,
        criteria: { mediaH2H, pctUnder45, mediaGolsHome, mediaGolsAway },
        reasons,
        status: 'pending',
      }, { onConflict: 'match_id,mode' });
      inserted++;
    } catch (e) {
      console.error('prelive item err', e);
    }
  }
  return { mode: 'prelive', scanned: fixtures.length, inserted };
}

async function runLive() {
  const { data: lives } = await sb
    .from("live_matches")
    .select("match_id, championship, home_team, away_team, score_home, score_away, minute, status, odds_live")
    .eq("status", "live");

  let inserted = 0;
  for (const m of lives || []) {
    try {
      const goals = (m.score_home ?? 0) + (m.score_away ?? 0);
      const minute = m.minute ?? 0;
      let odd: number | null = null;
      const od = (m as any).odds_live;
      if (od && typeof od === 'object') {
        odd = Number(od?.under_4_5 ?? od?.['under_4.5'] ?? od?.under45 ?? null) || null;
      }
      if (odd == null) odd = await getOddUnder45(m.match_id);

      const { score, reasons, veto } = calcScoreLive({ minute, goals, odd });
      if (veto || score < SCORE_THRESHOLD) continue;

      await sb.from("sinais_alavanca").upsert({
        match_id: m.match_id,
        match_name: `${m.home_team} x ${m.away_team}`,
        league: m.championship,
        mode: 'live',
        score,
        odd_under45: odd,
        minute,
        goals_total: goals,
        criteria: { minute, goals, odd },
        reasons,
        status: 'pending',
      }, { onConflict: 'match_id,mode' });
      inserted++;
    } catch (e) {
      console.error('live item err', e);
    }
  }
  return { mode: 'live', scanned: lives?.length ?? 0, inserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'prelive' ? 'prelive' : 'live';
    const result = mode === 'prelive' ? await runPrelive() : await runLive();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('sinais-alavanca-scanner', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
