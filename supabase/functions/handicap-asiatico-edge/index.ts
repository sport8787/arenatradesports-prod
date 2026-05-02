// =============================================================================
// HANDICAP ASIÁTICO — EDGE (PRÉ-LIVE) — MYCROFT + GEMINI
// -----------------------------------------------------------------------------
// Pipeline:
//   1. Coleta Sportmonks (forma + ELO proxy) + Odds (The Odds API / API-Football)
//   2. Score determinístico (ELO + forma + odds + movimento de mercado)
//   3. 🧠 Mycroft (Gemini direto v1beta) decide veredito final usando o score
//      como UM dos inputs (não decisão final). Frio, dedutivo, em pt-br.
//   4. Persiste apenas APROVADOS em punter_analyses, com confiança da IA.
// Fallback: se Gemini indisponível, usa veredito determinístico do score.
// =============================================================================


import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getUpcomingFixturesSM,
  getRecentFixturesSM,
} from '../_shared/sportmonks-af-adapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY') || '';
const ODDS_API_KEY = Deno.env.get('THE_ODDS_API_KEY') || Deno.env.get('ODDS_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
const AF_BASE = 'https://v3.football.api-sports.io';

// Ligas suportadas (mesmo whitelist do prelive antigo)
const LIGAS_PERMITIDAS = new Set([71, 72, 39, 40, 140, 135, 78, 79, 61, 94, 203, 144, 88, 179, 253, 262, 197, 307]);
const LIGAS_ODDS_MAP: Record<number, string> = {
  39: 'soccer_epl', 140: 'soccer_spain_la_liga', 135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga', 61: 'soccer_france_ligue_one',
  71: 'soccer_brazil_campeonato', 88: 'soccer_netherlands_eredivisie', 94: 'soccer_portugal_primeira_liga',
};

// =============================================================================
// HELPERS
// =============================================================================

async function afFetch(path: string, params: Record<string, string | number>) {
  const url = new URL(`${AF_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString(), { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
  if (!r.ok) throw new Error(`AF ${path} → ${r.status}`);
  return (await r.json()).response;
}

// Movimento de mercado: comparar abertura vs atual (best-effort via API-Football /odds)
type MarketMovement = { homeDropping: boolean; awayDropping: boolean; homeOpen?: number; homeNow?: number };

async function getOddsAndMovement(fixtureId: number, leagueId: number, homeTeam: string, awayTeam: string): Promise<{
  oddsAH: { home: number | null; away: number | null };
  homeMatchOdd: number | null;
  awayMatchOdd: number | null;
  marketMovement: MarketMovement;
}> {
  const result = {
    oddsAH: { home: null as number | null, away: null as number | null },
    homeMatchOdd: null as number | null,
    awayMatchOdd: null as number | null,
    marketMovement: { homeDropping: false, awayDropping: false } as MarketMovement,
  };

  // 1) Odds atuais (preferência: The Odds API)
  const sportKey = LIGAS_ODDS_MAP[leagueId];
  if (sportKey && ODDS_API_KEY) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,asian_handicap&oddsFormat=decimal`;
      const data = await (await fetch(url)).json() as any[];
      const game = Array.isArray(data) ? data.find((g: any) =>
        g.home_team?.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase()) ||
        g.away_team?.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase())
      ) : null;
      if (game) {
        for (const bm of game.bookmakers || []) {
          for (const mkt of bm.markets || []) {
            if (mkt.key === 'h2h') {
              const h = mkt.outcomes.find((o: any) => o.name === game.home_team);
              const a = mkt.outcomes.find((o: any) => o.name === game.away_team);
              if (h && !result.homeMatchOdd) result.homeMatchOdd = h.price;
              if (a && !result.awayMatchOdd) result.awayMatchOdd = a.price;
            }
            if (mkt.key === 'asian_handicap') {
              for (const o of mkt.outcomes || []) {
                if (Math.abs(o.point) <= 0.5) {
                  if (o.name === game.home_team && !result.oddsAH.home) result.oddsAH.home = o.price;
                  if (o.name === game.away_team && !result.oddsAH.away) result.oddsAH.away = o.price;
                }
              }
            }
          }
          if (result.homeMatchOdd && result.awayMatchOdd && result.oddsAH.home) break;
        }
      }
    } catch (e) { console.warn('[HA-edge] Odds API erro', e); }
  }

  // 2) Fallback API-Football odds + movimento
  if (!result.homeMatchOdd && API_FOOTBALL_KEY) {
    try {
      const oddsResp = await afFetch('/odds', { fixture: fixtureId });
      if (oddsResp?.length) {
        for (const item of oddsResp) {
          for (const bm of item.bookmakers || []) {
            for (const bet of bm.bets || []) {
              const name = (bet.name || '').toLowerCase();
              if (name === 'match winner' || name === '1x2') {
                for (const v of bet.values || []) {
                  const val = String(v.value).toLowerCase();
                  const odd = parseFloat(v.odd);
                  if ((val === 'home' || val === '1') && !result.homeMatchOdd) result.homeMatchOdd = odd;
                  if ((val === 'away' || val === '2') && !result.awayMatchOdd) result.awayMatchOdd = odd;
                }
              }
              if (name.includes('asian handicap')) {
                for (const v of bet.values || []) {
                  const m = String(v.value).match(/(home|away)\s*\(?(-?\+?\d+(?:\.\d+)?)\)?/i);
                  if (!m) continue;
                  const side = m[1].toLowerCase();
                  const num = parseFloat(m[2]);
                  if (Math.abs(num) <= 0.5) {
                    if (side === 'home' && !result.oddsAH.home) result.oddsAH.home = parseFloat(v.odd);
                    if (side === 'away' && !result.oddsAH.away) result.oddsAH.away = parseFloat(v.odd);
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) { console.warn('[HA-edge] AF odds erro', e); }
  }

  // 3) Movimento de mercado: compara odd atual vs odd histórica salva (snapshot 6h+)
  try {
    const { data: snap } = await supabase
      .from('ah_odds_snapshot')
      .select('home_odd, away_odd, captured_at')
      .eq('fixture_id', String(fixtureId))
      .order('captured_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (snap && result.homeMatchOdd) {
      result.marketMovement.homeOpen = snap.home_odd;
      result.marketMovement.homeNow = result.homeMatchOdd;
      // Drop ≥ 5% indica afluxo ao favorito
      if (snap.home_odd && result.homeMatchOdd < snap.home_odd * 0.95) {
        result.marketMovement.homeDropping = true;
      }
      if (snap.away_odd && result.awayMatchOdd && result.awayMatchOdd < snap.away_odd * 0.95) {
        result.marketMovement.awayDropping = true;
      }
    } else if (result.homeMatchOdd) {
      // Cria snapshot inicial (próximas execuções terão referência)
      await supabase.from('ah_odds_snapshot').insert({
        fixture_id: String(fixtureId),
        home_odd: result.homeMatchOdd,
        away_odd: result.awayMatchOdd,
      }).select().maybeSingle();
    }
  } catch (e) { /* tabela pode não existir — sem movimento */ }

  return result;
}

// ELO/Força: derivada de win-rate dos últimos 12 jogos (proxy estável)
function eloFromRecent(fixtures: any[], teamId: number): number {
  if (!fixtures?.length) return 1500;
  let pts = 0, count = 0;
  for (const f of fixtures.slice(0, 12)) {
    const isHome = f?.teams?.home?.id === teamId;
    const gh = f?.goals?.home, ga = f?.goals?.away;
    if (gh == null || ga == null) continue;
    const won = isHome ? gh > ga : ga > gh;
    const drew = gh === ga;
    pts += won ? 3 : (drew ? 1 : 0);
    count++;
  }
  if (!count) return 1500;
  // 1500 base, ±200 conforme média de pontos (0..3)
  const ppg = pts / count;
  return Math.round(1500 + (ppg - 1.5) * 100);
}

function formScore(fixtures: any[], teamId: number): number {
  // Pontos nos últimos 5 jogos (max 15)
  if (!fixtures?.length) return 0;
  let pts = 0;
  for (const f of fixtures.slice(0, 5)) {
    const isHome = f?.teams?.home?.id === teamId;
    const gh = f?.goals?.home, ga = f?.goals?.away;
    if (gh == null || ga == null) continue;
    const won = isHome ? gh > ga : ga > gh;
    const drew = gh === ga;
    pts += won ? 3 : (drew ? 1 : 0);
  }
  return pts;
}

// =============================================================================
// MYCROFT JURY — Gemini direto (v1beta)
// =============================================================================

interface MycroftVerdict {
  verdict: 'APROVADO' | 'REPROVADO' | 'AGUARDAR';
  confidence: number;          // 0-100
  recommended_bet: string | null;
  justificativa: string;       // pt-br, frio, dedutivo
  fair_odd?: number | null;
  edge_pct?: number | null;
}

async function mycroftJury(input: {
  match: string;
  league: string;
  matchDate: string;
  scoreDeterministico: number;
  betSugerido: string | null;
  details: any;
}): Promise<MycroftVerdict> {
  // Fallback determinístico se Gemini indisponível
  const fallback = (): MycroftVerdict => ({
    verdict: input.scoreDeterministico >= 30 ? 'APROVADO' : (input.scoreDeterministico >= 25 ? 'APROVADO' : 'REPROVADO'),
    confidence: Math.min(95, 50 + input.scoreDeterministico),
    recommended_bet: input.betSugerido,
    justificativa: '⚠️ Veredito por fallback determinístico (Gemini indisponível).',
  });

  if (!GEMINI_API_KEY) return fallback();

  const prompt = `Você é o Mycroft — analista frio, dedutivo, em pt-br. NÃO TORCE. CALCULA.
Avalie esta oportunidade de Handicap Asiático PRÉ-LIVE com base nos inputs abaixo e devolva JSON puro.

JOGO: ${input.match}
LIGA: ${input.league}
DATA: ${input.matchDate}

📊 SCORE DETERMINÍSTICO: ${input.scoreDeterministico}/50
🎯 SUGESTÃO MATEMÁTICA: ${input.betSugerido ?? 'NENHUMA'}

DETALHES:
${JSON.stringify(input.details, null, 2)}

REGRAS DO MYCROFT:
- APROVADO apenas se há valor real (edge ≥ 4%) e contexto coerente.
- REPROVADO se odds não comportam stake (linhas extremas) ou inconsistência entre forma e ELO.
- AGUARDAR se faltam dados confiáveis.
- Confiança: 70-85 = sólido, 85-95 = excepcional. Acima disso só com edge claro.
- Justificativa: máximo 4 linhas, técnica e direta.

Responda APENAS com JSON neste formato:
{
  "verdict": "APROVADO" | "REPROVADO" | "AGUARDAR",
  "confidence": <number 0-100>,
  "recommended_bet": "<string ou null>",
  "justificativa": "<string pt-br curta>",
  "fair_odd": <number ou null>,
  "edge_pct": <number ou null>
}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      console.warn('[HA-edge] Gemini status', r.status);
      return fallback();
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as MycroftVerdict;
    if (!parsed.verdict) return fallback();
    return parsed;
  } catch (e) {
    console.warn('[HA-edge] Gemini erro', e);
    return fallback();
  }
}

// =============================================================================
// CORE — analyzeMatch
// =============================================================================

interface AnalyzeResult {
  match: string;
  homeTeam: string;
  awayTeam: string;
  fixtureId: number;
  leagueId: number;
  leagueName: string;
  matchDate: string;
  score: number;
  bet: string | null;
  isValue: boolean;
  mycroft: MycroftVerdict;
  details: {
    eloHome: number;
    eloAway: number;
    eloDiff: number;
    formHome: number;
    formAway: number;
    oddsAH_home: number | null;
    oddsAH_away: number | null;
    homeMatchOdd: number | null;
    marketMovement: MarketMovement;
  };
}

async function analyzeMatch(fixture: any): Promise<AnalyzeResult | null> {
  const fix = fixture.fixture;
  const league = fixture.league;
  const teams = fixture.teams;

  if (!LIGAS_PERMITIDAS.has(league.id)) return null;

  const [recentHome, recentAway, oddsBlock] = await Promise.all([
    getRecentFixturesSM(teams.home.id, 12).catch(() => []),
    getRecentFixturesSM(teams.away.id, 12).catch(() => []),
    getOddsAndMovement(fix.id, league.id, teams.home.name, teams.away.name),
  ]);

  const eloHome = eloFromRecent(recentHome, teams.home.id);
  const eloAway = eloFromRecent(recentAway, teams.away.id);
  const formHome = formScore(recentHome, teams.home.id);
  const formAway = formScore(recentAway, teams.away.id);

  let score = 0;
  const eloDiff = eloHome - eloAway;

  if (eloDiff > 80) score += 10;
  if (eloDiff > 150) score += 15;
  if (formHome > formAway) score += 10;

  const homeAH = oddsBlock.oddsAH.home;
  if (homeAH && homeAH >= 1.80 && homeAH <= 2.20) score += 15;

  if (oddsBlock.marketMovement.homeDropping) score += 10;

  let bet: string | null = null;
  if (score >= 30) bet = 'AH -0.25 (HOME)';
  else if (score >= 25) bet = 'AH -0.5 (HOME)';

  // 🧠 Camada Mycroft (Gemini) — decide veredito final usando score como input
  const mycroft = await mycroftJury({
    match: `${teams.home.name} vs ${teams.away.name}`,
    league: league.name,
    matchDate: fix.date,
    scoreDeterministico: score,
    betSugerido: bet,
    details: {
      eloHome, eloAway, eloDiff,
      formHome, formAway,
      oddsAH_home: homeAH,
      oddsAH_away: oddsBlock.oddsAH.away,
      homeMatchOdd: oddsBlock.homeMatchOdd,
      marketMovement: oddsBlock.marketMovement,
    },
  });

  return {
    match: `${teams.home.name} vs ${teams.away.name}`,
    homeTeam: teams.home.name,
    awayTeam: teams.away.name,
    fixtureId: fix.id,
    leagueId: league.id,
    leagueName: league.name,
    matchDate: fix.date,
    score,
    bet: mycroft.recommended_bet ?? bet,
    isValue: mycroft.verdict === 'APROVADO',
    mycroft,
    details: {
      eloHome, eloAway, eloDiff,
      formHome, formAway,
      oddsAH_home: homeAH,
      oddsAH_away: oddsBlock.oddsAH.away,
      homeMatchOdd: oddsBlock.homeMatchOdd,
      marketMovement: oddsBlock.marketMovement,
    },
  };
}

// =============================================================================
// PERSISTÊNCIA — espelha aprovados em punter_analyses
// =============================================================================

async function persistOpportunity(o: AnalyzeResult) {
  if (!o.isValue || !o.bet) return;

  const matchIdStd = `ha-edge-${o.fixtureId}`;
  const marketLabel = o.bet;
  const odd = o.details.oddsAH_home ?? 1.95;
  const confidence = o.mycroft.confidence ?? Math.min(95, 50 + o.score);

  const justificativa =
    `🧠 MYCROFT — ${o.mycroft.verdict} (${confidence}%)\n` +
    `${o.mycroft.justificativa}\n\n` +
    `🎯 ${o.bet}\n` +
    `📊 Score determinístico: ${o.score}/50\n` +
    (o.mycroft.fair_odd ? `⚖️ Fair odd: ${o.mycroft.fair_odd.toFixed(2)} | Edge: ${(o.mycroft.edge_pct ?? 0).toFixed(1)}%\n` : '') +
    `\n📈 Força (ELO proxy):\n` +
    `• Casa: ${o.details.eloHome} | Fora: ${o.details.eloAway} | Δ ${o.details.eloDiff}\n` +
    `🏃 Forma (últ. 5): Casa ${o.details.formHome} pts | Fora ${o.details.formAway} pts\n` +
    `💹 Odds AH casa: ${o.details.oddsAH_home?.toFixed(2) ?? '—'}\n` +
    `📉 Mercado: ${o.details.marketMovement.homeDropping ? 'CASA caindo (smart money)' : 'estável'}`;

  try {
    const { data: existing } = await supabase
      .from('punter_analyses')
      .select('id')
      .eq('match_id', matchIdStd)
      .eq('market', marketLabel)
      .maybeSingle();

    const payload: any = {
      match_id: matchIdStd,
      home_team: o.homeTeam,
      away_team: o.awayTeam,
      league: o.leagueName,
      commence_time: o.matchDate,
      market: marketLabel,
      bookmaker: 'handicap-asiatico-edge',
      odd,
      verdict: o.mycroft.verdict,
      confidence,
      thesis: `${o.bet} | Mycroft ${o.mycroft.verdict} ${confidence}% | Score ${o.score}`,
      analysis: justificativa,
      analyzed_by: 'mycroft-handicap-asiatico',
    };

    if (existing) {
      await supabase.from('punter_analyses').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('punter_analyses').insert(payload);
    }
  } catch (e) {
    console.error('[HA-edge] persist err', e);
  }
}

// =============================================================================
// HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = Date.now();
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }

    // Trigger gate (mantém compat com `?trigger=manual`)
    const url = new URL(req.url);
    const trigger = url.searchParams.get('trigger') || body?.trigger || 'manual';
    if (trigger !== 'manual' && trigger !== 'cron') {
      return new Response(JSON.stringify({ error: 'Invalid trigger' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Buscar jogos pré-live via Sportmonks
    const ligas = Array.from(LIGAS_PERMITIDAS);
    const smFixtures = await getUpcomingFixturesSM(ligas, 25).catch((e) => {
      console.error('[HA-edge] getUpcomingFixturesSM', e);
      return [];
    });
    console.log(`[HA-edge] ${smFixtures.length} jogos pré-live (Sportmonks)`);

    // 2) Analisar oportunidades em batches
    const opportunities: AnalyzeResult[] = [];
    for (let i = 0; i < smFixtures.length; i += 3) {
      const batch = smFixtures.slice(i, i + 3);
      const out = await Promise.allSettled(batch.map((f) => analyzeMatch(f)));
      for (const r of out) {
        if (r.status === 'fulfilled' && r.value && r.value.isValue) {
          opportunities.push(r.value);
        }
      }
      if (i + 3 < smFixtures.length) await new Promise((r) => setTimeout(r, 3000));
    }

    // 3) Ordenar por score e persistir
    opportunities.sort((a, b) => b.score - a.score);
    for (const o of opportunities) await persistOpportunity(o);

    return new Response(JSON.stringify({
      success: true,
      total: opportunities.length,
      jogos_analisados: smFixtures.length,
      aprovados: opportunities.length,
      duracao_segundos: ((Date.now() - start) / 1000).toFixed(1),
      opportunities: opportunities.map((o) => ({
        match: o.match,
        score: o.score,
        bet: o.bet,
        mycroft: {
          verdict: o.mycroft.verdict,
          confidence: o.mycroft.confidence,
          justificativa: o.mycroft.justificativa,
          fair_odd: o.mycroft.fair_odd,
          edge_pct: o.mycroft.edge_pct,
        },
        details: {
          eloDiff: o.details.eloDiff,
          formHome: o.details.formHome,
          formAway: o.details.formAway,
          odds: o.details.oddsAH_home,
          marketDropping: o.details.marketMovement.homeDropping,
        },
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[HA-edge] handler err', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
