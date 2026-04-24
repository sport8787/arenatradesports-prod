import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CASHOUT_MODE = Deno.env.get('CASHOUT_MODE') || 'simulado';
const BETFAIR_APP_KEY = Deno.env.get('BETFAIR_APP_KEY') || '';
const BETFAIR_SESSION = Deno.env.get('BETFAIR_SESSION_TOKEN') || '';

// ═══════════════════════════════════════════════════
// MÓDULO 1 — ESTIMATIVA DETERMINÍSTICA DE ODD
// Fórmula baseada em fatores: placar, tempo, stats
// ═══════════════════════════════════════════════════
function estimarOdd(bet: any, stats: any): { odd: number; fatores: any; confianca: number } {
  const oddEntrada = bet.entry_odd || bet.odd;
  const mercado = bet.market || 'Casa';
  const minuto = stats?.minute ?? 45;
  const scoreH = stats?.score_home ?? 0;
  const scoreA = stats?.score_away ?? 0;
  const diff = scoreH - scoreA;

  // ── FATOR PLACAR ──
  let fp = 1.0;
  if (mercado === 'Casa' || mercado === 'Back Casa') {
    fp = diff >= 2 ? 0.55 : diff === 1 ? 0.75 : diff === 0 ? 1.0 : diff === -1 ? 1.50 : 2.10;
  } else if (mercado === 'Fora' || mercado === 'Back Fora') {
    fp = diff <= -2 ? 0.55 : diff === -1 ? 0.75 : diff === 0 ? 1.0 : diff === 1 ? 1.50 : 2.10;
  } else if (mercado === 'Empate' || mercado === 'Back Empate') {
    fp = diff === 0 ? 0.85 : 1.40;
  } else if (mercado?.startsWith('Over')) {
    const gols = scoreH + scoreA;
    const linha = parseFloat(mercado.replace(/Over\s?/, '')) || 2.5;
    fp = gols >= Math.ceil(linha) ? 0.10 : gols === Math.floor(linha) ? 0.65 : 1.20;
  } else if (mercado?.startsWith('Under')) {
    const gols = scoreH + scoreA;
    const linha = parseFloat(mercado.replace(/Under\s?/, '')) || 2.5;
    fp = gols >= Math.ceil(linha) ? 3.50 : gols === Math.floor(linha) - 1 ? 1.30 : 0.80;
  }

  // ── FATOR TEMPO ──
  let ft = minuto < 30 ? 1.0 : minuto < 45 ? 0.97 : minuto < 60 ? 0.95 : minuto < 70 ? 0.92 : minuto < 80 ? 0.88 : minuto < 85 ? 0.84 : minuto < 90 ? 0.80 : 0.76;
  if (mercado?.startsWith('Under') && fp < 1.5) ft = 1.0 + (1.0 - ft);

  // ── FATOR STATS ──
  let fs = 1.0;
  const xgH = stats?.xg_home ?? 0, xgA = stats?.xg_away ?? 0;
  const atH = stats?.dangerous_attacks_home ?? stats?.attacks_home ?? 0;
  const atA = stats?.dangerous_attacks_away ?? stats?.attacks_away ?? 0;
  const shH = stats?.shots_on_target_home ?? stats?.shots_on_goal_home ?? 0;
  const shA = stats?.shots_on_target_away ?? stats?.shots_on_goal_away ?? 0;

  if (mercado === 'Casa' || mercado === 'Back Casa') {
    const dom = (xgH > xgA * 1.3) || (atH > atA * 1.5) || (shH > shA * 1.5);
    const press = (xgA > xgH * 1.3) || (atA > atH * 1.5);
    fs = dom ? 0.93 : press ? 1.10 : 1.0;
  } else if (mercado === 'Fora' || mercado === 'Back Fora') {
    const dom = (xgA > xgH * 1.3) || (atA > atH * 1.5);
    const press = (xgH > xgA * 1.3) || (atH > atA * 1.5);
    fs = dom ? 0.93 : press ? 1.10 : 1.0;
  } else if (mercado?.startsWith('Over')) {
    fs = (xgH + xgA > 2.0 || atH + atA > 30) ? 0.92 : 1.05;
  } else if (mercado?.startsWith('Under')) {
    fs = (xgH + xgA < 1.0 && atH + atA < 15) ? 0.90 : 1.08;
  }

  // ── CÁLCULO FINAL ──
  let odd = Math.round(Math.max(1.01, Math.min(oddEntrada * fp * ft * fs, oddEntrada * 3.5)) * 100) / 100;

  let confianca = 60;
  if (xgH > 0 || xgA > 0) confianca += 15;
  if (atH > 0 || atA > 0) confianca += 10;
  if (shH > 0 || shA > 0) confianca += 10;
  if (minuto > 70) confianca += 5;
  confianca = Math.min(confianca, 92);

  return { odd, fatores: { placar: fp, tempo: ft, stats: fs, oddEntrada, minuto, scoreH, scoreA }, confianca };
}

// ═══════════════════════════════════════════════════
// MÓDULO 2 — ODD REAL (Betfair Live — futuro)
// ═══════════════════════════════════════════════════
async function buscarOddReal(bet: any): Promise<number | null> {
  if (!BETFAIR_APP_KEY || !BETFAIR_SESSION || !bet.betfair_market_id) return null;
  try {
    const r = await fetch('https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Application': BETFAIR_APP_KEY, 'X-Authentication': BETFAIR_SESSION },
      body: JSON.stringify({ marketIds: [bet.betfair_market_id], priceProjection: { priceData: ['EX_BEST_OFFERS'] } }),
    });
    const data = await r.json();
    return data?.[0]?.runners?.find((x: any) => x.selectionId === bet.betfair_selection_id)?.ex?.availableToBack?.[0]?.price || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════
// MÓDULO 3 — CLASSIFICAÇÃO DE SAÚDE
// ═══════════════════════════════════════════════════
function classificarSaude(bet: any, oddAtual: number, minuto: number): { saude: string; sinal: boolean; motivo: string } {
  const oddEntrada = bet.entry_odd || bet.odd;
  const stake = bet.stake || 0;
  const cashoutPct = (oddEntrada / oddAtual); // >1 = profit, <1 = loss
  const mercado = bet.market || '';

  if (oddAtual > oddEntrada * 1.8) {
    return { saude: 'CRITICAL', sinal: true, motivo: `Odd subiu ${((oddAtual / oddEntrada - 1) * 100).toFixed(0)}% da entrada. Padrão possivelmente revertido.` };
  }
  if (minuto >= 80 && oddAtual > oddEntrada * 1.3) {
    return { saude: 'CRITICAL', sinal: true, motivo: `Minuto ${minuto} com posição negativa. Risco de perda total iminente.` };
  }
  if (mercado?.startsWith('Under') && oddAtual > oddEntrada * 2.5) {
    return { saude: 'CRITICAL', sinal: true, motivo: 'Mercado Under em risco crítico. Gols próximos do limite.' };
  }
  if (oddAtual > oddEntrada * 1.35) {
    return { saude: 'WARNING', sinal: false, motivo: `Odd subiu ${((oddAtual / oddEntrada - 1) * 100).toFixed(0)}%. Monitorar evolução.` };
  }
  if (minuto >= 82 && cashoutPct >= 1.5) {
    return { saude: 'HEALTHY', sinal: true, motivo: `GREEN de ${((cashoutPct - 1) * 100).toFixed(0)}% disponível nos minutos finais. Considere garantir o lucro.` };
  }
  return { saude: 'HEALTHY', sinal: false, motivo: 'Posição dentro do esperado.' };
}

// ═══════════════════════════════════════════════════
// REGRA ESPECÍFICA — UNDER 2.5 CASH OUT ALERT
// Gatilho 1: gol marcado após a entrada → SAIR AGORA (CRITICAL)
// Gatilho 2: pressão ofensiva crescente (1 critério) → ATENÇÃO (WARNING)
// Gatilho 3: 2+ critérios de pressão → SAIR AGORA (CRITICAL)
// ═══════════════════════════════════════════════════
function isUnder25Market(market: string): boolean {
  const m = String(market || '').toLowerCase().trim();
  if (!m.includes('under')) return false;
  // aceita "under 2.5", "under 2,5", "under2.5"
  const match = m.match(/under\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return false;
  const line = parseFloat(match[1].replace(',', '.'));
  return Math.abs(line - 2.5) < 0.01;
}

function evaluateUnder25Pressure(
  pos: any,
  matchState: MatchState,
): { triggered: boolean; severity: 'CRITICAL' | 'WARNING'; signalType: string; motivo: string; deltas?: any } | null {
  if (!isUnder25Market(pos.market)) return null;
  const entry = (pos.entry_stats || {}) as Record<string, number>;
  const stats: any = matchState.stats || {};

  const totalGoalsNow = (matchState.scoreHome ?? 0) + (matchState.scoreAway ?? 0);
  const totalGoalsEntry = (entry.score_home ?? 0) + (entry.score_away ?? 0);

  // ── GATILHO 1: gol marcado após a entrada ──
  if (totalGoalsNow > totalGoalsEntry) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      signalType: 'UNDER25_GOAL',
      motivo: '⚠️ SAIR AGORA — Gol marcado. Under 2.5 comprometido. Execute o cash out imediatamente.',
    };
  }

  // Sem baseline → não conseguimos avaliar pressão crescente; sai.
  if (!entry || Object.keys(entry).length === 0) return null;

  const daNow = (stats.dangerous_attacks_home ?? 0) + (stats.dangerous_attacks_away ?? 0);
  const stNow = (stats.shots_on_target_home ?? stats.shots_on_goal_home ?? 0) +
                (stats.shots_on_target_away ?? stats.shots_on_goal_away ?? 0);
  const xgNow = (stats.xG_home ?? stats.xg_home ?? 0) + (stats.xG_away ?? stats.xg_away ?? 0);

  const dDA = daNow - (entry.dangerous_attacks_total ?? 0);
  const dST = stNow - (entry.shots_on_target_total ?? 0);
  const dXG = xgNow - (entry.xg_total ?? 0);

  const xgAvailable = xgNow > 0 || (entry.xg_total ?? 0) > 0;

  const criteriaHit: string[] = [];
  if (dDA >= 4) criteriaHit.push(`Ataques perigosos +${dDA}`);
  if (dST >= 3) criteriaHit.push(`Chutes a gol +${dST}`);
  if (xgAvailable && dXG >= 0.5) criteriaHit.push(`xG +${dXG.toFixed(2)}`);

  if (criteriaHit.length === 0) return null;

  const deltas = { dDA, dST, dXG: Number(dXG.toFixed(2)), criteriaHit };

  // ── GATILHO 3: 2+ critérios → CRITICAL ──
  if (criteriaHit.length >= 2) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      signalType: 'UNDER25_EXPLOSIVE',
      motivo: `🚨 SAIR AGORA — Pressão ofensiva alta em ambos os lados. Risco de gol elevado. Under 2.5 em perigo. (${criteriaHit.join(' • ')})`,
      deltas,
    };
  }

  // ── GATILHO 2: 1 critério → WARNING ──
  return {
    triggered: true,
    severity: 'WARNING',
    signalType: 'UNDER25_PRESSURE',
    motivo: `⚠️ ATENÇÃO — Jogo ficando movimentado. Ataques perigosos e chutes aumentando. Considere cash out parcial ou saída preventiva. (${criteriaHit.join(' • ')})`,
    deltas,
  };
}

const HT_MARKET_REGEX = /\b(ht|1t|1º\s*tempo|primeiro\s*tempo|first\s*half)\b/i;

type MatchState = {
  matchId: string;
  homeTeam?: string;
  awayTeam?: string;
  minute: number;
  status: 'live' | 'halftime' | 'finished' | 'unknown';
  period?: string | null;
  scoreHome: number;
  scoreAway: number;
  halftimeHome: number | null;
  halftimeAway: number | null;
  stats?: any;
};

function normalizeTeam(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLine(market: string, fallback = 2.5): number {
  const matched = market.match(/(\d+(?:\.\d+)?)/);
  return matched ? parseFloat(matched[1]) : fallback;
}

function isFirstHalfMarket(market: string): boolean {
  return HT_MARKET_REGEX.test(market) || /gol\s*ht/i.test(market);
}

function inferSelectionSide(market: string, homeTeam?: string, awayTeam?: string): 'home' | 'away' | null {
  const normalizedMarket = market.toLowerCase().trim();
  if (normalizedMarket === 'casa' || normalizedMarket === 'home' || normalizedMarket === '1' || normalizedMarket.includes('back casa')) return 'home';
  if (normalizedMarket === 'fora' || normalizedMarket === 'away' || normalizedMarket === '2' || normalizedMarket.includes('back fora') || normalizedMarket.includes('back visitante')) return 'away';

  const namedSelection = normalizedMarket.replace(/^back\s+/i, '').trim();
  if (!namedSelection) return null;

  const homeNorm = normalizeTeam(homeTeam);
  const awayNorm = normalizeTeam(awayTeam);
  const selectionNorm = normalizeTeam(namedSelection);

  const matchesTeam = (teamNorm: string) =>
    !!teamNorm && (
      teamNorm.includes(selectionNorm) ||
      selectionNorm.includes(teamNorm) ||
      teamNorm.split(' ').some((word) => word.length > 3 && selectionNorm.includes(word))
    );

  if (matchesTeam(homeNorm)) return 'home';
  if (matchesTeam(awayNorm)) return 'away';
  return null;
}

function normalizeMatchStatus(status?: string | null, period?: string | null): MatchState['status'] {
  const normalizedStatus = String(status || '').toLowerCase();
  const normalizedPeriod = String(period || '').toLowerCase();
  if (['finished', 'ft', 'aet', 'pen', 'ended'].some((value) => normalizedStatus.includes(value) || normalizedPeriod.includes(value))) return 'finished';
  if (['halftime', 'ht', 'intervalo'].some((value) => normalizedStatus.includes(value) || normalizedPeriod.includes(value))) return 'halftime';
  if (normalizedStatus || normalizedPeriod) return 'live';
  return 'unknown';
}

async function fetchApiFootballSnapshot(matchId: string): Promise<Partial<MatchState> | null> {
  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey || !/^\d+$/.test(matchId)) return null;

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const fixture = data.response?.[0];
    if (!fixture) return null;

    return {
      homeTeam: fixture.teams?.home?.name || undefined,
      awayTeam: fixture.teams?.away?.name || undefined,
      minute: fixture.fixture?.status?.elapsed ?? 0,
      period: fixture.fixture?.status?.long || null,
      status: normalizeMatchStatus(fixture.fixture?.status?.short, fixture.fixture?.status?.long),
      scoreHome: fixture.goals?.home ?? 0,
      scoreAway: fixture.goals?.away ?? 0,
      halftimeHome: fixture.score?.halftime?.home ?? null,
      halftimeAway: fixture.score?.halftime?.away ?? null,
    };
  } catch (error) {
    console.warn(`[evaluate-cashout] API-Football snapshot failed for ${matchId}:`, error);
    return null;
  }
}

async function resolveMatchState(matchId: string, supabase: any, cache: Map<string, MatchState | null>): Promise<MatchState | null> {
  if (cache.has(matchId)) return cache.get(matchId) ?? null;

  const { data: liveMatch } = await supabase.from('live_matches').select('*').eq('match_id', matchId).maybeSingle();
  const apiSnapshot = await fetchApiFootballSnapshot(matchId);

  const resolved: MatchState | null = liveMatch || apiSnapshot ? {
    matchId,
    homeTeam: liveMatch?.home_team || apiSnapshot?.homeTeam,
    awayTeam: liveMatch?.away_team || apiSnapshot?.awayTeam,
    minute: liveMatch?.minute ?? apiSnapshot?.minute ?? 0,
    status: apiSnapshot?.status || normalizeMatchStatus(liveMatch?.status, liveMatch?.period),
    period: liveMatch?.period || apiSnapshot?.period || null,
    scoreHome: liveMatch?.score_home ?? apiSnapshot?.scoreHome ?? 0,
    scoreAway: liveMatch?.score_away ?? apiSnapshot?.scoreAway ?? 0,
    halftimeHome: apiSnapshot?.halftimeHome ?? null,
    halftimeAway: apiSnapshot?.halftimeAway ?? null,
    stats: liveMatch?.stats || null,
  } : null;

  cache.set(matchId, resolved);
  return resolved;
}

function evaluateSettlement(marketRaw: string, matchState: MatchState): { shouldSettle: boolean; isGreen: boolean; reason: string } {
  const market = String(marketRaw || '').toLowerCase().trim();
  const normalizedMarket = /gol\s*ht/i.test(market) ? 'over 0.5 ht' : market;
  const totalGoals = (matchState.scoreHome ?? 0) + (matchState.scoreAway ?? 0);
  const secondHalfStarted = matchState.status === 'halftime' || matchState.status === 'finished' || matchState.minute >= 45 || /second|2nd|2t|intervalo|ht/i.test(String(matchState.period || ''));
  const halftimeHome = matchState.halftimeHome ?? (matchState.status === 'halftime' ? matchState.scoreHome : null);
  const halftimeAway = matchState.halftimeAway ?? (matchState.status === 'halftime' ? matchState.scoreAway : null);
  const halftimeTotal = halftimeHome != null && halftimeAway != null ? halftimeHome + halftimeAway : null;

  if (isFirstHalfMarket(normalizedMarket)) {
    if (!secondHalfStarted && halftimeTotal == null) {
      return { shouldSettle: false, isGreen: false, reason: 'Mercado HT ainda aberto.' };
    }

    const htTotal = halftimeTotal ?? 0;
    if (normalizedMarket.includes('under')) {
      const line = extractLine(normalizedMarket, 0.5);
      return {
        shouldSettle: true,
        isGreen: htTotal < line,
        reason: `HT ${halftimeHome ?? 0}x${halftimeAway ?? 0}`,
      };
    }

    const line = extractLine(normalizedMarket, 0.5);
    return {
      shouldSettle: true,
      isGreen: htTotal > line,
      reason: `HT ${halftimeHome ?? 0}x${halftimeAway ?? 0}`,
    };
  }

  if (normalizedMarket.includes('over')) {
    const line = extractLine(normalizedMarket, 2.5);
    if (totalGoals > line) return { shouldSettle: true, isGreen: true, reason: `Over confirmado com ${matchState.scoreHome}x${matchState.scoreAway}` };
    if (matchState.status === 'finished') return { shouldSettle: true, isGreen: false, reason: `Over não bateu no placar final ${matchState.scoreHome}x${matchState.scoreAway}` };
    return { shouldSettle: false, isGreen: false, reason: 'Over ainda aberto.' };
  }

  if (normalizedMarket.includes('under')) {
    const line = extractLine(normalizedMarket, 2.5);
    if (totalGoals > line) return { shouldSettle: true, isGreen: false, reason: `Under estourou com ${matchState.scoreHome}x${matchState.scoreAway}` };
    if (matchState.status === 'finished') return { shouldSettle: true, isGreen: true, reason: `Under confirmado no placar final ${matchState.scoreHome}x${matchState.scoreAway}` };
    return { shouldSettle: false, isGreen: false, reason: 'Under ainda aberto.' };
  }

  if (normalizedMarket.includes('btts') || normalizedMarket.includes('ambas')) {
    if (matchState.scoreHome > 0 && matchState.scoreAway > 0) return { shouldSettle: true, isGreen: true, reason: 'Ambas marcaram.' };
    if (matchState.status === 'finished') return { shouldSettle: true, isGreen: false, reason: 'Ambas não marcaram até o fim.' };
    return { shouldSettle: false, isGreen: false, reason: 'BTTS ainda aberto.' };
  }

  if (matchState.status !== 'finished') {
    return { shouldSettle: false, isGreen: false, reason: 'Mercado depende do placar final.' };
  }

  if (normalizedMarket === 'empate' || normalizedMarket === 'draw' || normalizedMarket === 'x' || normalizedMarket.includes('back empate')) {
    return { shouldSettle: true, isGreen: matchState.scoreHome === matchState.scoreAway, reason: `FT ${matchState.scoreHome}x${matchState.scoreAway}` };
  }

  const backSide = inferSelectionSide(normalizedMarket, matchState.homeTeam, matchState.awayTeam);
  if (backSide === 'home') {
    return { shouldSettle: true, isGreen: matchState.scoreHome > matchState.scoreAway, reason: `FT ${matchState.scoreHome}x${matchState.scoreAway}` };
  }
  if (backSide === 'away') {
    return { shouldSettle: true, isGreen: matchState.scoreAway > matchState.scoreHome, reason: `FT ${matchState.scoreHome}x${matchState.scoreAway}` };
  }

  if (normalizedMarket.includes('lay')) {
    const laySide = normalizedMarket.includes('casa') || normalizedMarket.includes('home')
      ? 'home'
      : normalizedMarket.includes('fora') || normalizedMarket.includes('away') || normalizedMarket.includes('visitante')
        ? 'away'
        : inferSelectionSide(normalizedMarket.replace(/^lay\s+/i, 'back '), matchState.homeTeam, matchState.awayTeam);

    if (laySide === 'home') {
      return { shouldSettle: true, isGreen: matchState.scoreHome <= matchState.scoreAway, reason: `FT ${matchState.scoreHome}x${matchState.scoreAway}` };
    }
    if (laySide === 'away') {
      return { shouldSettle: true, isGreen: matchState.scoreAway <= matchState.scoreHome, reason: `FT ${matchState.scoreHome}x${matchState.scoreAway}` };
    }
  }

  return { shouldSettle: false, isGreen: false, reason: 'Mercado não suportado para liquidação automática.' };
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const matchStateCache = new Map<string, MatchState | null>();

    // Support both cron (all pending) and on-demand (specific user/bet)
    let userId: string | null = null;
    let betId: string | null = null;
    try { const body = await req.json(); userId = body.user_id; betId = body.bet_id; } catch {}

    let query = supabase.from('virtual_bets').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    if (betId) query = query.eq('id', betId);

    const { data: positions, error: posErr } = await query;
    if (posErr || !positions?.length) {
      return new Response(JSON.stringify({ message: 'Nenhuma posição aberta', evaluated: 0, modo: CASHOUT_MODE }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[evaluate-cashout] ${positions.length} positions | mode=${CASHOUT_MODE}`);
    let evaluated = 0, autoCashedOut = 0;
    const results: any[] = [];

    for (const pos of positions) {
      try {
        const liveMatch = await resolveMatchState(pos.match_id, supabase, matchStateCache);
        
        // ═══ IN-GAME SETTLEMENT: check if bet condition is already definitively met ═══
        if (liveMatch && (liveMatch.status === 'live' || liveMatch.status === 'halftime' || liveMatch.status === 'finished')) {
          const scoreH = liveMatch.scoreHome ?? 0;
          const scoreA = liveMatch.scoreAway ?? 0;
          const minuto = liveMatch.minute || 0;
          const settlement = evaluateSettlement(pos.market || '', liveMatch);

          if (settlement.shouldSettle) {
            const isGreen = settlement.isGreen;
            const profitLoss = isGreen ? +(pos.stake * (pos.odd - 1)).toFixed(2) : -pos.stake;
            const betResult = isGreen ? 'green' : 'red';
            
            console.log(`[evaluate-cashout] ⚡ IN-GAME SETTLE: ${pos.match_name} | ${pos.market} | ${scoreH}-${scoreA} | ${betResult} | R$${profitLoss} | ${settlement.reason}`);

            await supabase.from('virtual_bets').update({
              status: betResult, profit_loss: profitLoss,
              score_home: scoreH, score_away: scoreA,
              settled_at: new Date().toISOString(),
              mycroft_cashout_reason: `[AUTO] ${settlement.reason}`,
            }).eq('id', pos.id);

            // Update sports_bankroll
            const { data: bankrollData } = await supabase.from('sports_bankroll').select('*').eq('user_id', pos.user_id).single();
            if (bankrollData) {
              const balanceAdd = isGreen ? pos.stake * pos.odd : 0;
              const g = (bankrollData.green_bets || 0) + (isGreen ? 1 : 0);
              const r = (bankrollData.red_bets || 0) + (isGreen ? 0 : 1);
              await supabase.from('sports_bankroll').update({
                balance: Math.round(((bankrollData.balance || 0) + balanceAdd) * 100) / 100,
                total_profit: Math.round(((bankrollData.total_profit || 0) + profitLoss) * 100) / 100,
                green_bets: g, red_bets: r,
                win_rate: g + r > 0 ? (g / (g + r)) * 100 : 0,
                updated_at: new Date().toISOString(),
              }).eq('user_id', pos.user_id);
            }

            // Log settlement
            await supabase.from('cashout_signals_log').insert({
              bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
              match_name: pos.match_name, market: pos.market,
              entry_odd: pos.entry_odd || pos.odd, current_odd: pos.odd,
              cashout_value: isGreen ? pos.stake * pos.odd : 0, stake: pos.stake,
              signal_type: 'AUTO_SETTLE', position_health: betResult.toUpperCase(),
              mycroft_reason: settlement.reason,
              was_accepted: true, accepted_at: new Date().toISOString(),
              placar: `${scoreH}-${scoreA}`, minuto,
            });

            autoCashedOut++;
            evaluated++;
            results.push({
              bet_id: pos.id, match: pos.match_name, result: betResult,
              profit_loss: profitLoss, reason: 'in_game_settlement',
              score: `${scoreH}-${scoreA}`, minute: minuto,
            });
            continue; // Skip normal cashout evaluation
          }
        }

        // ═══ NORMAL CASHOUT EVALUATION (only for live/halftime) ═══
        if (!liveMatch || (liveMatch.status !== 'live' && liveMatch.status !== 'halftime')) continue;

        const stats = liveMatch.stats as any || {};
        const entryOdd = pos.entry_odd || pos.odd;
        const minuto = liveMatch.minute || 0;

        // ═══ REGRA UNDER 2.5 — Cash Out Alert (prioritária) ═══
        // Dispara antes da avaliação genérica para que a mensagem específica chegue ao usuário primeiro.
        const u25 = evaluateUnder25Pressure(pos, liveMatch);
        if (u25?.triggered) {
          const placar = `${liveMatch.scoreHome ?? 0}-${liveMatch.scoreAway ?? 0}`;
          console.log(`[evaluate-cashout] 🛑 UNDER25 ${u25.signalType} ${pos.match_name} ${placar} min ${minuto} :: ${u25.motivo}`);

          // Marca o sinal na própria posição (UI exibe via realtime).
          await supabase.from('virtual_bets').update({
            mycroft_cashout_signal: true,
            mycroft_cashout_reason: u25.motivo,
            last_cashout_update: new Date().toISOString(),
          }).eq('id', pos.id);

          // Dedupe: evita re-loggar o mesmo gatilho em loops consecutivos.
          const { data: lastLog } = await supabase
            .from('cashout_signals_log')
            .select('id, signal_type, placar')
            .eq('bet_id', pos.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const sameTrigger = lastLog
            && lastLog.signal_type === u25.signalType
            && (u25.signalType !== 'UNDER25_GOAL' || lastLog.placar === placar);

          if (!sameTrigger) {
            await supabase.from('cashout_signals_log').insert({
              bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
              match_name: pos.match_name, market: pos.market,
              entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
              cashout_value: pos.cashout_value ?? pos.stake, stake: pos.stake,
              signal_type: u25.signalType,
              position_health: u25.severity,
              mycroft_reason: u25.motivo,
              fatores: u25.deltas ?? null,
              minuto, placar,
            });
          }
          // Não interrompe o fluxo — segue para a avaliação genérica abaixo,
          // mantendo current_odd/cashout_value atualizados (sem sobrescrever motivo).
        }


        // Build stats object for estimation
        const statsCtx = {
          minute: minuto, score_home: liveMatch.scoreHome ?? 0, score_away: liveMatch.scoreAway ?? 0,
          xg_home: stats.xG_home ?? stats.xg_home ?? 0, xg_away: stats.xG_away ?? stats.xg_away ?? 0,
          dangerous_attacks_home: stats.dangerous_attacks_home ?? 0, dangerous_attacks_away: stats.dangerous_attacks_away ?? 0,
          shots_on_target_home: stats.shots_on_target_home ?? 0, shots_on_target_away: stats.shots_on_target_away ?? 0,
          possession_home: stats.possession_home ?? 50, possession_away: stats.possession_away ?? 50,
        };

        // Determine current odd
        let oddAtual: number;
        let oddFonte: 'real' | 'estimada';
        let confianca = 0;
        let fatores: any = null;

        if (CASHOUT_MODE === 'live') {
          const oddReal = await buscarOddReal(pos);
          if (oddReal) {
            oddAtual = oddReal; oddFonte = 'real'; confianca = 100;
          } else {
            const est = estimarOdd(pos, statsCtx);
            oddAtual = est.odd; oddFonte = 'estimada'; confianca = est.confianca; fatores = est.fatores;
          }
        } else {
          const est = estimarOdd(pos, statsCtx);
          oddAtual = est.odd; oddFonte = 'estimada'; confianca = est.confianca; fatores = est.fatores;
        }

        const cashoutValue = Math.round(Math.max(0, pos.stake * (entryOdd / oddAtual)) * 100) / 100;
        const { saude, sinal, motivo } = classificarSaude(pos, oddAtual, minuto);

        console.log(`[evaluate-cashout] ${pos.match_name} | @${entryOdd}→${oddAtual} | R$${cashoutValue} | ${saude} | signal=${sinal} | ${oddFonte}`);

        // Update position — Under 2.5 (u25) tem prioridade sobre a saúde genérica.
        const finalSinal = (u25?.triggered ?? false) || sinal;
        const finalMotivo = u25?.triggered ? u25.motivo : (sinal ? motivo : null);
        await supabase.from('virtual_bets').update({
          current_odd: oddAtual, cashout_value: cashoutValue, cashout_odd: oddAtual,
          odd_fonte: oddFonte,
          mycroft_cashout_signal: finalSinal,
          mycroft_cashout_reason: finalMotivo,
          last_cashout_update: new Date().toISOString(),
        }).eq('id', pos.id);

        evaluated++;

        // Log signal if WARNING/CRITICAL or cashout signal
        if (sinal || saude !== 'HEALTHY') {
          await supabase.from('cashout_signals_log').insert({
            bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
            match_name: pos.match_name, market: pos.market,
            entry_odd: entryOdd, current_odd: oddAtual,
            cashout_value: cashoutValue, stake: pos.stake,
            signal_type: saude, position_health: saude,
            mycroft_reason: motivo, confidence: confianca,
            odd_fonte: oddFonte, modo: CASHOUT_MODE,
            fatores: fatores, minuto: minuto,
            placar: `${statsCtx.score_home}-${statsCtx.score_away}`,
          });
        }

        const pnl = Math.round((cashoutValue - pos.stake) * 100) / 100;
        results.push({
          bet_id: pos.id, match: pos.match_name, entry_odd: entryOdd,
          current_odd: oddAtual, cashout_value: cashoutValue, stake: pos.stake,
          pnl, health: saude, signal: sinal, odd_fonte: oddFonte, confianca,
        });

        // Auto cash out with protection
        if (pos.auto_cashout_enabled && sinal) {
          const minValue = pos.auto_cashout_min_value ?? (pos.stake * 0.5);
          if (cashoutValue < minValue) {
            console.log(`[evaluate-cashout] AUTO BLOCKED: ${pos.match_name} R$${cashoutValue} < min R$${minValue}`);
            continue;
          }

          console.log(`[evaluate-cashout] AUTO CASHOUT: ${pos.match_name} → R$${cashoutValue}`);
          const { data: bankrollData } = await supabase.from('sports_bankroll').select('*').eq('user_id', pos.user_id).single();
          if (bankrollData) {
            const profitLoss = Math.round((cashoutValue - pos.stake) * 100) / 100;
            const isProfit = profitLoss >= 0;

            await supabase.from('virtual_bets').update({
              status: 'cashed_out', profit_loss: profitLoss, cashed_out_at: new Date().toISOString(),
              mycroft_cashout_reason: `[AUTO] ${motivo}`,
            }).eq('id', pos.id);

            const g = (bankrollData.green_bets || 0) + (isProfit ? 1 : 0);
            const r = (bankrollData.red_bets || 0) + (isProfit ? 0 : 1);
            await supabase.from('sports_bankroll').update({
              balance: Math.round(((bankrollData.balance || 0) + cashoutValue) * 100) / 100,
              total_profit: Math.round(((bankrollData.total_profit || 0) + profitLoss) * 100) / 100,
              green_bets: g, red_bets: r,
              win_rate: g + r > 0 ? (g / (g + r)) * 100 : 0,
              updated_at: new Date().toISOString(),
            }).eq('user_id', pos.user_id);

            await supabase.from('cashout_signals_log').update({
              was_accepted: true, accepted_at: new Date().toISOString(),
            }).eq('bet_id', pos.id).is('was_accepted', null).order('created_at', { ascending: false }).limit(1);

            autoCashedOut++;
          }
        }
      } catch (e) { console.error(`[evaluate-cashout] Error ${pos.match_name}:`, e); }
    }

    return new Response(JSON.stringify({
      message: `${evaluated} avaliadas, ${autoCashedOut} auto-cashouts`,
      evaluated, auto_cashed_out: autoCashedOut, modo: CASHOUT_MODE, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[evaluate-cashout] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
