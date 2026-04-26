// =============================================================================
// EVENTOS RAROS — Pre-Live Analysis
// Roda 2x ao dia (09:00 e 15:00 BRT) via cron.
// Identifica jogos candidatos a placares raros (LAY GOLEADA / 2x2 / 1x3 / 3x1)
// usando estatísticas da API-Football.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

const API_BASE = "https://v3.football.api-sports.io";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Whitelist de ligas mais previsíveis para placares raros (mesma da Trader Sports)
const LIGAS_PERMITIDAS = [
  39, 40, 41, 78, 79, 135, 136, 140, 141, 61, 62, 71, 72, 73, 75, 76,
  88, 94, 144, 203, 207, 218, 253, 262, 281, 2, 3, 4, 5, 11, 13,
];

type PlacarTipo = "LAY_GOLEADA" | "LAY_2x2" | "LAY_1x3" | "LAY_3x1";

interface Indicadores {
  freq_goleada_home: number;
  freq_goleada_away: number;
  freq_goleada_h2h: number;
  freq_2x2_h2h: number;
  freq_1x3_h2h: number;
  forca_ofensiva_home: number;
  forca_ofensiva_away: number;
  fragilidade_def_home: number;
  fragilidade_def_away: number;
  media_gols_h2h: number;
  clean_sheet_rate_home: number;
  clean_sheet_rate_away: number;
  desequilibrio_forcas: number;
}

async function apiFootball(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API_BASE}${path}?${qs}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!r.ok) throw new Error(`API ${path} ${r.status}`);
  const j = await r.json();
  return j.response ?? [];
}

async function buscarFixturesHoje() {
  const hoje = new Date().toISOString().split("T")[0];
  const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [a, b] = await Promise.all([
    apiFootball("/fixtures", { date: hoje }),
    apiFootball("/fixtures", { date: amanha }),
  ]);
  return [...a, ...b].filter((f: any) =>
    LIGAS_PERMITIDAS.includes(f.league.id) &&
    f.fixture.status.short === "NS"
  );
}

function calcGoleadaH2H(h2h: any[]): number {
  if (!h2h?.length) return 0;
  const goleadas = h2h.filter((m) => {
    const diff = Math.abs((m.goals.home ?? 0) - (m.goals.away ?? 0));
    return diff >= 3;
  }).length;
  return (goleadas / h2h.length) * 100;
}

function calcPlacarH2H(h2h: any[], home: number, away: number): number {
  if (!h2h?.length) return 0;
  const c = h2h.filter((m) => m.goals.home === home && m.goals.away === away).length;
  return (c / h2h.length) * 100;
}

function calcMediaGolsH2H(h2h: any[]): number {
  if (!h2h?.length) return 0;
  const t = h2h.reduce((s, m) => s + (m.goals.home ?? 0) + (m.goals.away ?? 0), 0);
  return t / h2h.length;
}

function calcFreqGoleadaTime(stats: any): number {
  if (!stats?.fixtures) return 0;
  const total = stats.fixtures.played?.total ?? 0;
  if (!total) return 0;
  // proxy: usa biggest wins e loses para estimar; fallback se ausente
  const big = stats.biggest?.goals;
  if (!big) return 0;
  const maxFor = big.for?.home ?? 0;
  const maxAgainst = big.against?.home ?? 0;
  // Estimativa conservadora: se já houve goleadas históricas
  return ((maxFor >= 3 ? 1 : 0) + (maxAgainst >= 3 ? 1 : 0)) * 15;
}

function indicadores(statsHome: any, statsAway: any, h2h: any[]): Indicadores {
  const goalsForHome = parseFloat(statsHome?.goals?.for?.average?.total ?? "0");
  const goalsAgainstHome = parseFloat(statsHome?.goals?.against?.average?.total ?? "0");
  const goalsForAway = parseFloat(statsAway?.goals?.for?.average?.total ?? "0");
  const goalsAgainstAway = parseFloat(statsAway?.goals?.against?.average?.total ?? "0");

  const playedHome = statsHome?.fixtures?.played?.total ?? 1;
  const playedAway = statsAway?.fixtures?.played?.total ?? 1;
  const csHome = statsHome?.clean_sheet?.total ?? 0;
  const csAway = statsAway?.clean_sheet?.total ?? 0;

  return {
    freq_goleada_home: calcFreqGoleadaTime(statsHome),
    freq_goleada_away: calcFreqGoleadaTime(statsAway),
    freq_goleada_h2h: calcGoleadaH2H(h2h),
    freq_2x2_h2h: calcPlacarH2H(h2h, 2, 2),
    freq_1x3_h2h: calcPlacarH2H(h2h, 1, 3),
    forca_ofensiva_home: goalsForHome,
    forca_ofensiva_away: goalsForAway,
    fragilidade_def_home: goalsAgainstHome,
    fragilidade_def_away: goalsAgainstAway,
    media_gols_h2h: calcMediaGolsH2H(h2h),
    clean_sheet_rate_home: (csHome / playedHome) * 100,
    clean_sheet_rate_away: (csAway / playedAway) * 100,
    desequilibrio_forcas: Math.abs(goalsForHome - goalsForAway) +
      Math.abs(goalsAgainstHome - goalsAgainstAway),
  };
}

function escolherPlacarAlvo(ind: Indicadores, scoreMin = 60): {
  alvo: PlacarTipo | null;
  alternativo: PlacarTipo | null;
  score: number;
} {
  const opcoes: Array<{ tipo: PlacarTipo; score: number }> = [];

  // LAY_GOLEADA: H2H raramente goleadas, forças equilibradas, defesas razoáveis
  let scoreGoleada = 0;
  if (ind.freq_goleada_h2h < 15) scoreGoleada += 35;
  if (ind.desequilibrio_forcas < 1.0) scoreGoleada += 25;
  if (ind.fragilidade_def_home < 1.5 && ind.fragilidade_def_away < 1.5) scoreGoleada += 25;
  if (ind.media_gols_h2h < 3) scoreGoleada += 15;
  opcoes.push({ tipo: "LAY_GOLEADA", score: scoreGoleada });

  // LAY_2x2: 2x2 raro historicamente
  let score2x2 = 0;
  if (ind.freq_2x2_h2h < 5) score2x2 += 50;
  if (ind.clean_sheet_rate_home > 30 || ind.clean_sheet_rate_away > 30) score2x2 += 30;
  opcoes.push({ tipo: "LAY_2x2", score: score2x2 });

  // LAY_1x3 / LAY_3x1: placares específicos
  let score1x3 = 0;
  if (ind.freq_1x3_h2h < 5) score1x3 += 45;
  if (ind.forca_ofensiva_away < 1.8) score1x3 += 25;
  opcoes.push({ tipo: "LAY_1x3", score: score1x3 });

  let score3x1 = 0;
  if (ind.forca_ofensiva_home < 1.8) score3x1 += 45;
  if (ind.fragilidade_def_away < 1.8) score3x1 += 25;
  opcoes.push({ tipo: "LAY_3x1", score: score3x1 });

  opcoes.sort((a, b) => b.score - a.score);
  if (opcoes[0].score < scoreMin) return { alvo: null, alternativo: null, score: opcoes[0].score };
  return {
    alvo: opcoes[0].tipo,
    alternativo: opcoes[1]?.score >= Math.max(scoreMin - 10, 30) ? opcoes[1].tipo : null,
    score: opcoes[0].score,
  };
}

async function processarFixture(f: any) {
  const matchId = String(f.fixture.id);
  const exist = await sb.from("eventos_raros_candidatos").select("id").eq("match_id", matchId).maybeSingle();
  if (exist.data) return null;

  const params = { league: f.league.id, season: f.league.season };
  const [statsHome, statsAway, h2h] = await Promise.all([
    apiFootball("/teams/statistics", { ...params, team: f.teams.home.id }).then((r) => r ?? {}),
    apiFootball("/teams/statistics", { ...params, team: f.teams.away.id }).then((r) => r ?? {}),
    apiFootball("/fixtures/headtohead", {
      h2h: `${f.teams.home.id}-${f.teams.away.id}`,
      last: 10,
    }),
  ]);

  const ind = indicadores(statsHome, statsAway, h2h);
  const { alvo, alternativo, score } = escolherPlacarAlvo(ind);

  const status = alvo ? "APROVADO" : "DESCARTADO";

  await sb.from("eventos_raros_candidatos").insert({
    match_id: matchId,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    league_id: f.league.id,
    league_name: f.league.name,
    match_date: f.fixture.date,
    season: f.league.season,
    placar_alvo: alvo,
    placar_alternativo: alternativo,
    score_qualidade: score,
    status,
    motivo_descarte: alvo ? null : `Score insuficiente: ${score}`,
    arenas: ["punter", "trader_sports"],
    ...ind,
  });

  return alvo ? { match: `${f.teams.home.name} x ${f.teams.away.name}`, alvo, score } : null;
}

async function notificarTelegram(aprovados: any[]) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !aprovados.length) return;
  const linhas = aprovados.slice(0, 10).map((a, i) =>
    `${i + 1}️⃣ ${a.match}\n🎯 ${a.alvo} · Score ${a.score}/100`
  ).join("\n━━━━━━\n");
  const msg = `🔮 EVENTOS RAROS — ${aprovados.length} candidatos\n\n${linhas}`;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const fixtures = await buscarFixturesHoje();
    console.log(`[eventos-raros-prelive] ${fixtures.length} fixtures encontradas`);
    const aprovados: any[] = [];
    for (const f of fixtures.slice(0, 80)) {
      try {
        const ap = await processarFixture(f);
        if (ap) aprovados.push(ap);
      } catch (e) {
        console.error("[fixture]", f.fixture?.id, e);
      }
    }
    await notificarTelegram(aprovados);
    return new Response(
      JSON.stringify({ analisadas: fixtures.length, aprovadas: aprovados.length, aprovados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[eventos-raros-prelive] erro", e);
    await logEdgeError("eventos-raros-prelive", e).catch(() => {});
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
