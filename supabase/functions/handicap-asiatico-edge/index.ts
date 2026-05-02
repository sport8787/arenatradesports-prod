// =============================================================================
// HANDICAP ASIÁTICO — EDGE (PRÉ-LIVE) — MYCROFT + GEMINI + xG real
// -----------------------------------------------------------------------------
// Núcleo matemático adaptado da revisão do DeepSeek (corrigido):
//   1. xG/forma reais via SportMonks (últimos 10 jogos finalizados de cada time)
//   2. Odds AH reais via The Odds API (linhas -0.5 / +0.5 / -1.0 / +1.0)
//   3. Probabilidade de cobertura via Poisson de diferença (CORRIGIDO — sem o
//      bug do operador-vírgula do código original)
//   4. Edge real = oddBookmaker / oddJusta - 1
//   5. 🧠 Mycroft (Gemini direto v1beta) decide veredito final usando edge,
//      score, forma e contexto. Frio, dedutivo, em pt-br.
//   6. Persiste APENAS aprovados em punter_sinais com UNIQUE(match_id, market).
// Fallback: se Gemini indisponível, usa veredito determinístico por edge.
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SPORTMONKS_KEY   = Deno.env.get('SPORTMONKS_API_KEY') || '';
const ODDS_API_KEY     = Deno.env.get('THE_ODDS_API_KEY') || Deno.env.get('ODDS_API_KEY') || '';
const TELEGRAM_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT    = Deno.env.get('TELEGRAM_CHAT_ID') || '';
const GEMINI_API_KEY   = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL     = 'gemini-2.5-flash';
const GEMINI_URL       = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
const SM_BASE  = 'https://api.sportmonks.com/v3/football';

// =============================================================================
// TIPOS
// =============================================================================

interface TeamStats {
  teamId: number;
  teamName: string;
  avg_xg_for: number;
  avg_xg_against: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  form_points: number; // 0..30 (10 jogos × 3)
  games: number;
}

interface OddsAH {
  lines: Record<string, { home?: number; away?: number }>;
}

interface MycroftVerdict {
  verdict: 'APROVADO' | 'REPROVADO' | 'AGUARDAR';
  confidence: number;
  recommended_bet: string | null;
  justificativa: string;
  fair_odd?: number | null;
  edge_pct?: number | null;
}

interface AHSignal {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  matchDate: string; // ISO
  linha: string;     // ex '-0.5'
  lado: 'home' | 'away';
  oddAH: number;
  probReal: number;
  oddJusta: number;
  edge: number;
  score: number;
  status: 'SINAL_FORTE' | 'SINAL_BOM' | 'CUIDADO' | 'DESCARTADO';
  stake: number;
  indicadores: any;
  mycroft: MycroftVerdict;
}

// =============================================================================
// SPORTMONKS
// =============================================================================

async function smFetch(path: string, include = ''): Promise<any> {
  if (!SPORTMONKS_KEY) return null;
  const url = `${SM_BASE}${path}?api_token=${SPORTMONKS_KEY}${include ? `&include=${include}` : ''}&per_page=50`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d.data ?? null;
  } catch { return null; }
}

// Versão paginada: itera por todas as páginas usando pagination.has_more
async function smFetchAll(path: string, include = '', maxPages = 20): Promise<any[]> {
  if (!SPORTMONKS_KEY) return [];
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${SM_BASE}${path}?api_token=${SPORTMONKS_KEY}${include ? `&include=${include}` : ''}&per_page=50&page=${page}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn(`[HA-edge] smFetchAll page=${page} status=${r.status}`);
        break;
      }
      const d = await r.json();
      const arr = Array.isArray(d?.data) ? d.data : [];
      all.push(...arr);
      const hasMore = d?.pagination?.has_more === true;
      if (!hasMore || arr.length === 0) break;
    } catch (e) {
      console.warn(`[HA-edge] smFetchAll page=${page} erro:`, (e as any)?.message);
      break;
    }
  }
  return all;
}

function defaultStats(teamId: number, teamName: string): TeamStats {
  return {
    teamId, teamName,
    avg_xg_for: 1.2, avg_xg_against: 1.2,
    avg_goals_scored: 1.2, avg_goals_conceded: 1.2,
    form_points: 7.5, games: 0,
  };
}

async function getTeamStats(teamId: number, teamName: string): Promise<TeamStats> {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const fixtures = await smFetch(
    `/fixtures/between/${start}/${end}/${teamId}`,
    'scores;xGFixture;participants;state',
  );
  if (!fixtures || !Array.isArray(fixtures)) return defaultStats(teamId, teamName);

  let totalXgFor = 0, totalXgAgainst = 0, totalGoalsScored = 0, totalGoalsConceded = 0, formPoints = 0;
  let gamesCount = 0;

  for (const f of fixtures) {
    const state = f.state?.short_name || f.state?.state || '';
    if (!['FT', 'AET', 'PEN', 'finished'].includes(state)) continue;
    if (gamesCount >= 10) break;
    gamesCount++;

    // xG
    const xgData = f.xGFixture ?? [];
    const xgFor = parseFloat(xgData.find((x: any) => x.participant_id === teamId)?.data?.value ?? 0) || 0;
    const xgAgainst = parseFloat(xgData.find((x: any) => x.participant_id !== teamId)?.data?.value ?? 0) || 0;
    totalXgFor += xgFor;
    totalXgAgainst += xgAgainst;

    // Gols + lado (home/away)
    const participants = f.participants ?? [];
    const isHome = participants.find((p: any) => p.id === teamId)?.meta?.location === 'home';
    const scores = f.scores ?? [];
    const homeS = scores.find((s: any) =>
      (s.description === 'CURRENT' || s.description === 'FT') &&
      (s.score?.participant === 'home' || s.participant === 'home' || s.type === 'home')
    );
    const awayS = scores.find((s: any) =>
      (s.description === 'CURRENT' || s.description === 'FT') &&
      (s.score?.participant === 'away' || s.participant === 'away' || s.type === 'away')
    );
    const altScores = scores.filter((s: any) => s.description === 'CURRENT' || s.description === 'FT');
    let gh = parseInt(homeS?.score?.goals ?? altScores[0]?.score?.goals ?? 0) || 0;
    let ga = parseInt(awayS?.score?.goals ?? altScores[1]?.score?.goals ?? 0) || 0;

    if (isHome) {
      totalGoalsScored += gh;
      totalGoalsConceded += ga;
      if (gh > ga) formPoints += 3;
      else if (gh === ga) formPoints += 1;
    } else {
      totalGoalsScored += ga;
      totalGoalsConceded += gh;
      if (ga > gh) formPoints += 3;
      else if (ga === gh) formPoints += 1;
    }
  }

  if (gamesCount === 0) return defaultStats(teamId, teamName);

  return {
    teamId, teamName,
    avg_xg_for: parseFloat((totalXgFor / gamesCount).toFixed(3)),
    avg_xg_against: parseFloat((totalXgAgainst / gamesCount).toFixed(3)),
    avg_goals_scored: parseFloat((totalGoalsScored / gamesCount).toFixed(2)),
    avg_goals_conceded: parseFloat((totalGoalsConceded / gamesCount).toFixed(2)),
    form_points: formPoints,
    games: gamesCount,
  };
}

// =============================================================================
// THE ODDS API — Asian Handicap real
// =============================================================================

const ODDS_SPORT_MAP: Record<string, string> = {
  // por nome de liga (case-insensitive, contains)
  'premier league': 'soccer_epl',
  'championship': 'soccer_efl_champ',
  'la liga': 'soccer_spain_la_liga',
  'segunda': 'soccer_spain_segunda_division',
  'serie a': 'soccer_italy_serie_a',
  'serie b': 'soccer_italy_serie_b',
  'bundesliga': 'soccer_germany_bundesliga',
  '2. bundesliga': 'soccer_germany_bundesliga2',
  'ligue 1': 'soccer_france_ligue_one',
  'ligue 2': 'soccer_france_ligue_two',
  'brasileir': 'soccer_brazil_campeonato',
  'série b': 'soccer_brazil_serie_b',
  'eredivisie': 'soccer_netherlands_eredivisie',
  'primeira liga': 'soccer_portugal_primeira_liga',
  'super lig': 'soccer_turkey_super_league',
  'champions league': 'soccer_uefa_champs_league',
  'europa league': 'soccer_uefa_europa_league',
  'conference league': 'soccer_uefa_europa_conference_league',
  'mls': 'soccer_usa_mls',
  'liga mx': 'soccer_mexico_ligamx',
  'primera división': 'soccer_argentina_primera_division',
  'primera division': 'soccer_argentina_primera_division',
  'a-league': 'soccer_australia_aleague',
  'j league': 'soccer_japan_j_league',
  'j1': 'soccer_japan_j_league',
  'k league': 'soccer_korea_kleague1',
  'belgian': 'soccer_belgium_first_div',
  'jupiler': 'soccer_belgium_first_div',
  'fa cup': 'soccer_fa_cup',
  'efl cup': 'soccer_england_efl_cup',
  'copa libertadores': 'soccer_conmebol_copa_libertadores',
  'sudamericana': 'soccer_conmebol_copa_sudamericana',
};

function formatHandicapLine(point: number): string {
  const rounded = Math.round(point * 100) / 100;
  const absFixed = Number.isInteger(rounded) ? Math.abs(rounded).toFixed(1) : Math.abs(rounded).toString();
  if (rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '-'}${absFixed}`;
}

function mapLeagueToSportKey(leagueName: string): string | null {
  const ln = (leagueName || '').toLowerCase();
  for (const [k, v] of Object.entries(ODDS_SPORT_MAP)) {
    if (ln.includes(k)) return v;
  }
  return null;
}

async function getOddsAH(homeTeam: string, awayTeam: string, leagueName: string): Promise<OddsAH> {
  const out: OddsAH = { lines: {} };
  const sportKey = mapLeagueToSportKey(leagueName);
  if (!sportKey || !ODDS_API_KEY) return out;

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=spreads&oddsFormat=decimal`;
    const r = await fetch(url);
    if (!r.ok) return out;
    const data = (await r.json()) as any[];
    const game = (data || []).find((g: any) =>
      g.home_team?.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase()) ||
      g.away_team?.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase()),
    );
    if (!game) return out;

    for (const bm of game.bookmakers || []) {
      for (const mkt of bm.markets || []) {
        if (mkt.key !== 'spreads') continue;
        for (const o of mkt.outcomes || []) {
          if (typeof o.point !== 'number') continue;
          // Normalizamos para a perspectiva HOME: ponto positivo do home = +N, negativo = -N
          const isHome = o.name === game.home_team;
          const point = isHome ? o.point : -o.point;
          const key = formatHandicapLine(point);
          out.lines[key] = out.lines[key] || {};
          if (isHome && !out.lines[key].home) out.lines[key].home = o.price;
          if (!isHome && !out.lines[key].away) out.lines[key].away = o.price;
        }
      }
    }
  } catch (e) {
    console.warn('[HA-edge] Odds API erro', e);
  }
  return out;
}

// =============================================================================
// PROBABILIDADE — Poisson de diferença (CORRIGIDO)
// =============================================================================

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function poissonProb(lambda: number, k: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Probabilidade de cobertura do handicap aplicado ao HOME.
 * handicap = -0.5 → home precisa vencer por 1+
 * handicap = +0.5 → home cobre se não perder
 * handicap = -1.0 → home precisa vencer por 2+; vence por 1 = push (consideramos 0.5)
 */
function probHomeCobreHandicap(homeXg: number, awayXg: number, handicap: number): number {
  let p = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const prob = poissonProb(homeXg, i) * poissonProb(awayXg, j);
      const diff = i - j + handicap; // handicap aplicado ao home
      if (diff > 0) p += prob;
      else if (diff === 0) p += prob * 0.5; // push
    }
  }
  return Math.min(0.97, Math.max(0.03, p));
}

// =============================================================================
// SCORING
// =============================================================================

function analyzeAH(
  homeStats: TeamStats,
  awayStats: TeamStats,
  oddsAH: OddsAH,
  linha: string,
  lado: 'home' | 'away',
): { probReal: number; oddJusta: number; edge: number; score: number; status: AHSignal['status']; stake: number; oddBookmaker: number | null } {
  const handicap = parseFloat(linha); // perspectiva HOME
  const oddsLookupKey = formatHandicapLine(lado === 'home' ? handicap : -handicap);

  // xG esperado: ataque do A x defesa do B (média)
  const homeLambda = (homeStats.avg_xg_for + awayStats.avg_xg_against) / 2;
  const awayLambda = (awayStats.avg_xg_for + homeStats.avg_xg_against) / 2;

  let probReal: number;
  if (lado === 'home') {
    probReal = probHomeCobreHandicap(homeLambda, awayLambda, handicap);
  } else {
    // Apostando no AWAY com handicap +N do home → equivale a away com -handicap
    probReal = probHomeCobreHandicap(awayLambda, homeLambda, -handicap);
  }

  // Ajuste suave de forma (até ±5%)
  const formDiff = (homeStats.form_points - awayStats.form_points) / 30;
  if (lado === 'home') probReal += formDiff * 0.05;
  else probReal -= formDiff * 0.05;
  probReal = Math.min(0.95, Math.max(0.05, probReal));

  const oddBookmaker = oddsAH.lines[oddsLookupKey]?.[lado] ?? null;
  if (!oddBookmaker) {
    return { probReal, oddJusta: 1 / probReal, edge: -100, score: 0, status: 'DESCARTADO', stake: 0, oddBookmaker: null };
  }

  const oddJusta = 1 / probReal;
  const edge = (oddBookmaker / oddJusta - 1) * 100;

  let score = 0, stake = 0;
  let status: AHSignal['status'] = 'DESCARTADO';

  if (oddBookmaker >= 1.70 && oddBookmaker <= 2.20) {
    if (edge >= 10) { score = Math.min(100, 70 + edge); status = 'SINAL_FORTE'; stake = 5; }
    else if (edge >= 5) { score = Math.min(100, 60 + edge); status = 'SINAL_BOM'; stake = 3; }
    else if (edge >= 3) { score = 55; status = 'CUIDADO'; stake = 2; }
  }

  return { probReal, oddJusta, edge, score, status, stake, oddBookmaker };
}

// =============================================================================
// MYCROFT — Gemini direto v1beta
// =============================================================================

async function mycroftJury(input: {
  match: string;
  league: string;
  matchDate: string;
  linha: string;
  lado: 'home' | 'away';
  edge: number;
  oddBookmaker: number;
  oddJusta: number;
  probReal: number;
  score: number;
  details: any;
}): Promise<MycroftVerdict> {
  const fallback = (): MycroftVerdict => ({
    verdict: input.edge >= 5 ? 'APROVADO' : (input.edge >= 3 ? 'AGUARDAR' : 'REPROVADO'),
    confidence: Math.min(95, 50 + Math.max(0, input.edge) * 3),
    recommended_bet: `AH ${input.linha} (${input.lado.toUpperCase()})`,
    justificativa: '⚠️ Veredito fallback determinístico (Gemini indisponível).',
    fair_odd: input.oddJusta,
    edge_pct: input.edge,
  });

  if (!GEMINI_API_KEY) return fallback();

  const prompt = `Você é o Mycroft — analista frio, dedutivo, em pt-br. NÃO TORCE. CALCULA.
Avalie esta oportunidade de Handicap Asiático PRÉ-LIVE.

JOGO: ${input.match}
LIGA: ${input.league}
DATA: ${input.matchDate}

🎯 OPERAÇÃO: AH ${input.linha} (${input.lado.toUpperCase()})
💹 Odd bookmaker: ${input.oddBookmaker.toFixed(2)}
⚖️ Odd justa (Poisson): ${input.oddJusta.toFixed(2)}
📊 Prob. real estimada: ${(input.probReal * 100).toFixed(1)}%
📈 Edge: ${input.edge.toFixed(2)}%
🎯 Score determinístico: ${input.score}/100

DETALHES (xG médio, forma, jogos amostrados):
${JSON.stringify(input.details, null, 2)}

REGRAS DO MYCROFT:
- APROVADO apenas se edge ≥ 4%, odd entre 1.70 e 2.20 e amostra mínima (≥ 5 jogos por time).
- REPROVADO se edge < 3% ou se amostra insuficiente (< 5 jogos) ou inconsistência forma vs xG.
- AGUARDAR se faltam dados confiáveis ou edge entre 3-4%.
- Confiança: 70-85 sólido, 85-95 excepcional.
- Justificativa: máximo 4 linhas, técnica, em pt-br.

Responda APENAS com JSON puro neste formato:
{
  "verdict": "APROVADO" | "REPROVADO" | "AGUARDAR",
  "confidence": <0-100>,
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
// FIXTURES DO DIA (SportMonks)
// =============================================================================

async function getFixturesProximas48h(): Promise<any[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const startStr = now.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  console.log(`[HA-edge] Buscando fixtures entre ${startStr} e ${endStr} (janela 48h, agora=${now.toISOString()})`);
  // Usa endpoint v3 /football/fixtures/between com paginação completa
  const data = await smFetchAll(`/fixtures/between/${startStr}/${endStr}`, 'participants;league;state', 20);
  console.log(`[HA-edge] Sportmonks retornou ${data.length} fixtures totais (todas as páginas)`);
  if (!data.length) return [];
  const nowMs = now.getTime();
  const endMs = end.getTime();
  const filtered = data.filter((f: any) => {
    const state = f.state?.short_name || f.state?.state || '';
    if (!['NS', 'not_started', 'scheduled'].includes(state)) return false;
    const startTs = f.starting_at ? new Date(f.starting_at.replace(' ', 'T') + 'Z').getTime() : 0;
    return startTs >= nowMs && startTs <= endMs;
  });
  // Apenas jogos com liga mapeada (única forma de ter odds AH reais)
  const comOdds = filtered.filter((f: any) => mapLeagueToSportKey(f.league?.name || '') !== null);
  const semOdds = filtered.filter((f: any) => mapLeagueToSportKey(f.league?.name || '') === null);
  console.log(`[HA-edge] ${filtered.length} pré-live | ${comOdds.length} com odds AH | ${semOdds.length} sem (descartados)`);
  // Limite p/ caber no tempo da edge function (~150s). Prioriza jogos mais próximos.
  const LIMIT = 30;
  const sortedByTime = comOdds.sort((a: any, b: any) => {
    const ta = new Date(a.starting_at.replace(' ', 'T') + 'Z').getTime();
    const tb = new Date(b.starting_at.replace(' ', 'T') + 'Z').getTime();
    return ta - tb;
  });
  return sortedByTime.slice(0, LIMIT);
}

// =============================================================================
// PERSISTÊNCIA — punter_sinais
// =============================================================================

async function persistSignal(s: AHSignal) {
  if (s.mycroft.verdict !== 'APROVADO') return;

  const matchId = `ha-edge-${s.fixtureId}`;
  const market = `AH ${s.linha} (${s.lado.toUpperCase()})`;

  const justificativa =
    `🧠 MYCROFT — ${s.mycroft.verdict} (${s.mycroft.confidence}%)\n` +
    `${s.mycroft.justificativa}\n\n` +
    `🎯 ${market}\n` +
    `📊 Prob. real: ${(s.probReal * 100).toFixed(1)}% | Odd justa: ${s.oddJusta.toFixed(2)}\n` +
    `💹 Odd bookmaker: ${s.oddAH.toFixed(2)} | Edge: ${s.edge.toFixed(2)}%\n` +
    `📈 Score: ${s.score}/100 (${s.status})\n\n` +
    `📊 xG/forma:\n` +
    `• Casa: xG ${s.indicadores.home_xg_for.toFixed(2)} (sof ${s.indicadores.home_xg_against.toFixed(2)}) | Forma ${s.indicadores.home_form}/30 (${s.indicadores.home_games}j)\n` +
    `• Fora: xG ${s.indicadores.away_xg_for.toFixed(2)} (sof ${s.indicadores.away_xg_against.toFixed(2)}) | Forma ${s.indicadores.away_form}/30 (${s.indicadores.away_games}j)`;

  const payload: any = {
    match_id: matchId,
    home_team: s.homeTeam,
    away_team: s.awayTeam,
    league: s.leagueName,
    commence_time: s.matchDate,
    market,
    bookmaker: 'the_odds_api',
    odd: s.oddAH,
    fair_odd: s.oddJusta,
    estimated_probability: s.probReal,
    implied_probability: s.oddAH ? 1 / s.oddAH : null,
    value_percentage: s.edge,
    verdict: s.mycroft.verdict,
    confidence: s.mycroft.confidence,
    stake_percentage: s.stake,
    thesis: `${market} | Edge ${s.edge.toFixed(1)}% | Mycroft ${s.mycroft.confidence}%`,
    analysis: justificativa,
    analyzed_by: 'mycroft-handicap-asiatico',
    status: 'pending',
  };

  try {
    const { data: existing } = await supabase
      .from('punter_sinais')
      .select('id')
      .eq('match_id', matchId)
      .eq('market', market)
      .maybeSingle();

    if (existing) {
      await supabase.from('punter_sinais').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('punter_sinais').insert(payload);
    }
  } catch (e) {
    console.error('[HA-edge] persist err', e);
  }
}

// =============================================================================
// TELEGRAM
// =============================================================================

async function notifyTelegram(s: AHSignal) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  const hora = new Date(s.matchDate).toLocaleTimeString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit' });
  const time = s.lado === 'home' ? s.homeTeam : s.awayTeam;
  const msg = `🎯 *HANDICAP ASIÁTICO — OPORTUNIDADE*
━━━━━━━━━━━━━━━━━━
⚽ *${s.homeTeam}* x *${s.awayTeam}*
🏆 ${s.leagueName}
🕐 ${hora} BRT

📌 *Linha:* AH ${s.linha} ao *${time}*
💹 *Odd:* ${s.oddAH.toFixed(2)}
📊 *Edge:* +${s.edge.toFixed(1)}%
🎯 *Mycroft:* ${s.mycroft.confidence}% (${s.mycroft.verdict})
📈 *Prob. real:* ${(s.probReal * 100).toFixed(1)}% (justa ${s.oddJusta.toFixed(2)})

🏦 _Executar na Betfair Exchange ou casa que ofereça AH_
━━━━━━━━━━━━━━━━━━
_Oráculo Mycroft_`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'Markdown' }),
    });
  } catch (e) { console.warn('[HA-edge] telegram', e); }
}

// =============================================================================
// HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = Date.now();
  try {
    const fixtures = await getFixturesProximas48h();
    console.log(`[HA-edge] ${fixtures.length} fixtures pré-live encontrados (janela 48h)`);

    const signals: AHSignal[] = [];
    const diagnostics = {
      linhas_testadas: 0,
      linhas_com_odds: 0,
      linhas_odds_faixa: 0,
      linhas_edge_ge_3: 0,
      gemini_chamado: 0,
      veredictos: { APROVADO: 0, AGUARDAR: 0, REPROVADO: 0 },
      top_edges: [] as Array<{ match: string; league: string; linha: string; lado: 'home' | 'away'; odd: number; edge: number; status: string }>,
    };
    const linhasAlvo: Array<{ linha: string; lado: 'home' | 'away' }> = [
      { linha: '-0.5', lado: 'home' },
      { linha: '+0.5', lado: 'away' },
      { linha: '-1.0', lado: 'home' },
      { linha: '+1.0', lado: 'away' },
    ];

    // Processa fixtures em batches paralelos de 5 (cabe no time-budget da edge)
    const BATCH_SIZE = 5;
    for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
      const batch = fixtures.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (fixture) => {
        const participants = fixture.participants ?? [];
        const homeP = participants.find((p: any) => p.meta?.location === 'home');
        const awayP = participants.find((p: any) => p.meta?.location === 'away');
        if (!homeP || !awayP) return;

        const leagueName = fixture.league?.name ?? 'Liga';
        const [homeStats, awayStats, oddsAH] = await Promise.all([
          getTeamStats(homeP.id, homeP.name),
          getTeamStats(awayP.id, awayP.name),
          getOddsAH(homeP.name, awayP.name, leagueName),
        ]);

        for (const { linha, lado } of linhasAlvo) {
          const an = analyzeAH(homeStats, awayStats, oddsAH, linha, lado);
          diagnostics.linhas_testadas += 1;
          if (an.oddBookmaker) {
            diagnostics.linhas_com_odds += 1;
            if (an.oddBookmaker >= 1.7 && an.oddBookmaker <= 2.2) diagnostics.linhas_odds_faixa += 1;
            diagnostics.top_edges.push({
              match: `${homeP.name} vs ${awayP.name}`,
              league: leagueName,
              linha,
              lado,
              odd: an.oddBookmaker,
              edge: Number(an.edge.toFixed(2)),
              status: an.status,
            });
          }
          if (an.status === 'DESCARTADO' || !an.oddBookmaker) continue;
          // PRÉ-FILTRO: só chama Gemini se edge >= 3% (economiza tempo/quota)
          if (an.edge < 3) continue;
          diagnostics.linhas_edge_ge_3 += 1;

          const indicadores = {
            home_xg_for: homeStats.avg_xg_for,
            home_xg_against: homeStats.avg_xg_against,
            home_form: homeStats.form_points,
            home_games: homeStats.games,
            away_xg_for: awayStats.avg_xg_for,
            away_xg_against: awayStats.avg_xg_against,
            away_form: awayStats.form_points,
            away_games: awayStats.games,
          };

          const mycroft = await mycroftJury({
            match: `${homeP.name} vs ${awayP.name}`,
            league: leagueName,
            matchDate: fixture.starting_at,
            linha, lado,
            edge: an.edge,
            oddBookmaker: an.oddBookmaker,
            oddJusta: an.oddJusta,
            probReal: an.probReal,
            score: an.score,
            details: indicadores,
          });
          diagnostics.gemini_chamado += 1;
          diagnostics.veredictos[mycroft.verdict] += 1;

          if (mycroft.verdict !== 'APROVADO') continue;

          signals.push({
            fixtureId: fixture.id,
            homeTeam: homeP.name,
            awayTeam: awayP.name,
            leagueName,
            matchDate: fixture.starting_at,
            linha, lado,
            oddAH: an.oddBookmaker,
            probReal: an.probReal,
            oddJusta: an.oddJusta,
            edge: an.edge,
            score: an.score,
            status: an.status,
            stake: an.stake,
            indicadores,
            mycroft,
          });
        }
      }));
      console.log(`[HA-edge] batch ${i / BATCH_SIZE + 1} concluído (${Math.min(i + BATCH_SIZE, fixtures.length)}/${fixtures.length})`);
    }

    // Top 4 por score
    const sorted = signals.sort((a, b) => b.score - a.score).slice(0, 4);
    for (const s of sorted) {
      await persistSignal(s);
      await notifyTelegram(s);
    }

    return new Response(JSON.stringify({
      success: true,
      jogos_analisados: fixtures.length,
      sinais_aprovados: signals.length,
      notificados: sorted.length,
      duracao_segundos: ((Date.now() - start) / 1000).toFixed(1),
      diagnostico: {
        ...diagnostics,
        top_edges: diagnostics.top_edges
          .sort((a, b) => b.edge - a.edge)
          .slice(0, 8),
      },
      opportunities: sorted.map((s) => ({
        match: `${s.homeTeam} vs ${s.awayTeam}`,
        league: s.leagueName,
        linha: s.linha,
        lado: s.lado,
        odd: s.oddAH,
        edge: s.edge,
        prob_real: s.probReal,
        score: s.score,
        mycroft: { verdict: s.mycroft.verdict, confidence: s.mycroft.confidence, justificativa: s.mycroft.justificativa },
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[HA-edge] handler err', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
