import { createClient } from 'npm:@supabase/supabase-js@2';
import { logEdgeError } from "../_shared/logEdgeError.ts";

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
const FUTODDS_KEY = Deno.env.get('FUTODDS_API_KEY') || '';
const FUTODDS_BASE = 'https://csv.futodds.com/functions/v1';

/** Busca odd ao vivo:
 *   1) Betfair Exchange via Futodds /matches-betfair-live-odds (last_price_traded — Phase 3),
 *   2) Futodds /matches-live-full (odds_live agregadas),
 *   3) Betfair Exchange direto (legacy app key).
 * Retorna { odd, fonte } onde fonte ∈ 'betfair_exchange' | 'futodds_live' | 'betfair_direct'.
 */
export interface OddRealResult { odd: number; fonte: string }

async function buscarOddRealDetalhe(bet: any): Promise<OddRealResult | null> {
  if (FUTODDS_KEY && bet.match_name && bet.market) {
    const [home, away] = String(bet.match_name).split(/\s+vs\s+/i);
    if (home && away) {
      // 1) Betfair Exchange real (last_price_traded) via /matches-betfair-live-odds
      try {
        const eventId = await resolveBetfairEventId(home.trim(), away.trim());
        if (eventId) {
          const odd = await fetchBetfairExchangeOdd(eventId, bet.market);
          if (odd && odd > 1.01) return { odd, fonte: 'betfair_exchange' };
        }
      } catch (e) { console.warn('[cashout] betfair_exchange error:', (e as Error).message); }

      // 2) Futodds odds_live agregadas
      try {
        const odd = await fetchFutoddsOdd(home.trim(), away.trim(), bet.market);
        if (odd && odd > 1.01) return { odd, fonte: 'futodds_live' };
      } catch (e) { console.warn('[cashout] futodds_odd error:', (e as Error).message); }
    }
  }

  // 3) Betfair Exchange direto (requer market_id+selection_id mapeados)
  if (!BETFAIR_APP_KEY || !BETFAIR_SESSION || !bet.betfair_market_id) return null;
  try {
    const r = await fetch('https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Application': BETFAIR_APP_KEY, 'X-Authentication': BETFAIR_SESSION },
      body: JSON.stringify({ marketIds: [bet.betfair_market_id], priceProjection: { priceData: ['EX_BEST_OFFERS'] } }),
    });
    const data = await r.json();
    const odd = data?.[0]?.runners?.find((x: any) => x.selectionId === bet.betfair_selection_id)?.ex?.availableToBack?.[0]?.price || null;
    return odd ? { odd, fonte: 'betfair_direct' } : null;
  } catch { return null; }
}

// Compat: assinatura antiga usada no resto do código.
async function buscarOddReal(bet: any): Promise<number | null> {
  const r = await buscarOddRealDetalhe(bet);
  return r?.odd ?? null;
}

// ═══════════════════════════════════════════════════
// Phase 3 — Betfair Exchange real (last_price_traded)
// Resolve event_id Betfair via /matches-betfair-live-compact (cache 60s)
// e busca odds back/lay reais via /matches-betfair-live-odds (cache 15s).
// ═══════════════════════════════════════════════════
const BF_COMPACT_CACHE: { ts: number; data: any[] } = { ts: 0, data: [] };
const BF_ODDS_CACHE = new Map<string, { ts: number; data: any }>();
const _norm = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

async function resolveBetfairEventId(home: string, away: string): Promise<string | null> {
  const now = Date.now();
  let list = BF_COMPACT_CACHE.data;
  if (now - BF_COMPACT_CACHE.ts > 60_000 || list.length === 0) {
    const r = await fetch(`${FUTODDS_BASE}/matches-betfair-live-compact`, {
      headers: { Authorization: `Bearer ${FUTODDS_KEY}`, 'X-API-Key': FUTODDS_KEY, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    list = Array.isArray(j?.data) ? j.data : [];
    BF_COMPACT_CACHE.ts = now;
    BF_COMPACT_CACHE.data = list;
  }
  const h = _norm(home), a = _norm(away);
  const m = list.find((x: any) => _norm(x.home_name || x.home).includes(h) && _norm(x.away_name || x.away).includes(a))
         || list.find((x: any) => h.includes(_norm(x.home_name || x.home)) && a.includes(_norm(x.away_name || x.away)));
  return m?.event_id ? String(m.event_id) : null;
}

async function fetchBetfairExchangeOdd(eventId: string, market: string): Promise<number | null> {
  const now = Date.now();
  let entry = BF_ODDS_CACHE.get(eventId);
  if (!entry || now - entry.ts > 15_000) {
    const r = await fetch(`${FUTODDS_BASE}/matches-betfair-live-odds?event_id=${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${FUTODDS_KEY}`, 'X-API-Key': FUTODDS_KEY, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    entry = { ts: now, data: j?.data ?? j };
    BF_ODDS_CACHE.set(eventId, entry);
  }
  return pickBetfairExchangeOdd(entry.data, market);
}

/** Extrai odd back (last_price_traded → availableToBack[0].price) por mercado/runner. */
function pickBetfairExchangeOdd(payload: any, market: string): number | null {
  if (!payload) return null;
  const markets: any[] = Array.isArray(payload?.markets) ? payload.markets
    : Array.isArray(payload) ? payload : [];
  if (markets.length === 0) return null;

  const m = market.toLowerCase();
  const isOver = /\bover\b/.test(m), isUnder = /\bunder\b/.test(m);
  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const line = lineMatch ? parseFloat(lineMatch[1]) : null;
  const isBtts = /btts|ambas|both teams to score/.test(m);
  const isHome = /casa|home/.test(m), isAway = /fora|away/.test(m), isDraw = /empate|draw/.test(m);

  const findMarket = (predicate: (mk: any) => boolean) => markets.find(predicate);
  const runnerOdd = (runner: any): number | null => {
    if (!runner) return null;
    const lpt = Number(runner.last_price_traded);
    if (lpt && lpt > 1.01) return lpt;
    const back = runner?.ex?.availableToBack?.[0]?.price ?? runner?.back?.[0]?.price;
    return back && Number(back) > 1.01 ? Number(back) : null;
  };

  if (isOver || isUnder) {
    const mk = findMarket((x: any) => /OVER_UNDER|TOTAL_GOALS/i.test(x?.market_type || x?.market_name || '') &&
                                     (line ? String(x?.market_name || '').includes(String(line)) : true));
    const runner = mk?.runners?.find((r: any) => new RegExp(isOver ? 'over' : 'under', 'i').test(r?.runner_name || r?.name || ''));
    return runnerOdd(runner);
  }
  if (isBtts) {
    const mk = findMarket((x: any) => /BTTS|BOTH_TEAMS_TO_SCORE/i.test(x?.market_type || x?.market_name || ''));
    const want = /sim|yes/.test(m) ? /yes|sim/i : /no|n[ãa]o/i;
    const runner = mk?.runners?.find((r: any) => want.test(r?.runner_name || r?.name || ''));
    return runnerOdd(runner);
  }
  if (isHome || isAway || isDraw) {
    const mk = findMarket((x: any) => /MATCH_ODDS|1X2|FT_RESULT/i.test(x?.market_type || x?.market_name || ''));
    const want = isHome ? /home|casa|1\b/i : isAway ? /away|fora|2\b/i : /draw|empate|x\b/i;
    const runner = mk?.runners?.find((r: any) => want.test(r?.runner_name || r?.name || r?.selection_name || ''));
    return runnerOdd(runner);
  }
  return null;
}

const FUTODDS_LIVE_CACHE: { ts: number; data: any[] } = { ts: 0, data: [] };
async function fetchFutoddsOdd(home: string, away: string, market: string): Promise<number | null> {
  // Cache 30s do /matches-live-full (rate-limit friendly)
  const now = Date.now();
  let list = FUTODDS_LIVE_CACHE.data;
  if (now - FUTODDS_LIVE_CACHE.ts > 30_000 || list.length === 0) {
    const r = await fetch(`${FUTODDS_BASE}/matches-live-full`, {
      headers: { Authorization: `Bearer ${FUTODDS_KEY}`, 'X-API-Key': FUTODDS_KEY, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    list = Array.isArray(j?.data) ? j.data : [];
    FUTODDS_LIVE_CACHE.ts = now;
    FUTODDS_LIVE_CACHE.data = list;
  }
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
  const h = norm(home), a = norm(away);
  const match = list.find((m: any) => norm(m.home_name || '').includes(h) && norm(m.away_name || '').includes(a))
             || list.find((m: any) => h.includes(norm(m.home_name || '')) && a.includes(norm(m.away_name || '')));
  if (!match) return null;
  return pickOddLive(match.odds_live, market) ?? pickOddLive(match.odds, market);
}

function pickOddLive(odds: any, market: string): number | null {
  if (!odds) return null;
  const m = market.toLowerCase();
  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const line = lineMatch ? lineMatch[1].replace('.', '').padEnd(2, '5') : null;
  const isOver = /\bover\b/.test(m), isUnder = /\bunder\b/.test(m);
  const isBtts = /btts|ambas|both teams to score/.test(m);

  if (isBtts) {
    const bucket = odds.btts;
    if (/sim|yes/.test(m) && bucket?.yes) return Number(bucket.yes);
    if (/n[ãa]o|no/.test(m) && bucket?.no) return Number(bucket.no);
  }
  if ((isOver || isUnder) && line) {
    const k = `${isOver ? 'over' : 'under'}_${line}`;
    return Number(odds.total_goals?.[k]) || null;
  }
  if (/casa|home/.test(m)) return Number(odds.ft_result?.home) || null;
  if (/fora|away/.test(m)) return Number(odds.ft_result?.away) || null;
  if (/empate|draw/.test(m)) return Number(odds.ft_result?.draw) || null;
  return null;
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
// REGRA ESPECÍFICA — UNDER X.5 CASH OUT ALERT (genérico)
// Gatilho 1: gol marcado após a entrada → SAIR AGORA (CRITICAL)
// Gatilho 2: pressão ofensiva crescente (1 critério) → ATENÇÃO (WARNING)
// Gatilho 3: 2+ critérios de pressão → SAIR AGORA (CRITICAL)
// Thresholds são personalizáveis por usuário via tabela under_cashout_thresholds.
// ═══════════════════════════════════════════════════
const SUPPORTED_UNDER_LINES = [1.5, 2.5, 3.5, 4.5];

interface UnderThreshold {
  under_line: number;
  delta_dangerous_attacks: number;
  delta_shots_on_target: number;
  delta_xg: number;
  enabled: boolean;
}

const DEFAULT_THRESHOLD: Omit<UnderThreshold, 'under_line'> = {
  delta_dangerous_attacks: 4,
  delta_shots_on_target: 3,
  delta_xg: 0.5,
  enabled: true,
};

function getUnderLine(market: string): number | null {
  const m = String(market || '').toLowerCase().trim();
  if (!m.includes('under')) return null;
  const match = m.match(/under\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  const line = parseFloat(match[1].replace(',', '.'));
  return SUPPORTED_UNDER_LINES.find(l => Math.abs(l - line) < 0.01) ?? null;
}

function evaluateUnderPressure(
  pos: any,
  matchState: MatchState,
  threshold: UnderThreshold | null,
): { triggered: boolean; severity: 'CRITICAL' | 'WARNING'; signalType: string; motivo: string; deltas?: any } | null {
  const line = getUnderLine(pos.market);
  if (line == null) return null;

  // Threshold desativado pelo usuário → não emite alerta personalizado
  if (threshold && !threshold.enabled) return null;

  const t: UnderThreshold = threshold ?? { under_line: line, ...DEFAULT_THRESHOLD };

  const entry = (pos.entry_stats || {}) as Record<string, number>;
  const stats: any = matchState.stats || {};

  const totalGoalsNow = (matchState.scoreHome ?? 0) + (matchState.scoreAway ?? 0);
  const totalGoalsEntry = (entry.score_home ?? 0) + (entry.score_away ?? 0);

  // ── GATILHO 1: gol marcado após a entrada ──
  if (totalGoalsNow > totalGoalsEntry) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      signalType: `UNDER${String(line).replace('.', '')}_GOAL`,
      motivo: `⚠️ SAIR AGORA — Gol marcado. Under ${line} comprometido. Execute o cash out imediatamente.`,
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
  if (dDA >= t.delta_dangerous_attacks) criteriaHit.push(`Ataques perigosos +${dDA} (≥${t.delta_dangerous_attacks})`);
  if (dST >= t.delta_shots_on_target)   criteriaHit.push(`Chutes a gol +${dST} (≥${t.delta_shots_on_target})`);
  if (xgAvailable && dXG >= t.delta_xg) criteriaHit.push(`xG +${dXG.toFixed(2)} (≥${t.delta_xg})`);

  if (criteriaHit.length === 0) return null;

  const deltas = { dDA, dST, dXG: Number(dXG.toFixed(2)), criteriaHit, line, threshold: t };

  // ── GATILHO 3: 2+ critérios → CRITICAL ──
  if (criteriaHit.length >= 2) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      signalType: `UNDER${String(line).replace('.', '')}_EXPLOSIVE`,
      motivo: `🚨 SAIR AGORA — Pressão ofensiva alta em ambos os lados. Risco de gol elevado. Under ${line} em perigo. (${criteriaHit.join(' • ')})`,
      deltas,
    };
  }

  // ── GATILHO 2: 1 critério → WARNING ──
  return {
    triggered: true,
    severity: 'WARNING',
    signalType: `UNDER${String(line).replace('.', '')}_PRESSURE`,
    motivo: `⚠️ ATENÇÃO — Jogo ficando movimentado. Pressão crescente. Considere cash out parcial. Under ${line} sob risco. (${criteriaHit.join(' • ')})`,
    deltas,
  };
}

// ═══════════════════════════════════════════════════
// REGRA FUTODDS — PRESSÃO ADVERSA (Back Casa/Fora, Over)
// Usa pressure_indices + last5min/last10min Futodds para detectar
// inversão de momentum ou jogo morto que comprometam a entrada.
// Prioridade: roda APÓS under25 e ANTES da saúde genérica.
// ═══════════════════════════════════════════════════
function evaluateFutoddsPressure(
  pos: any,
  matchState: any,
): { triggered: boolean; severity: 'CRITICAL' | 'WARNING'; signalType: string; motivo: string; deltas?: any } | null {
  const stats: any = matchState?.stats || {};
  const market = String(pos.market || '').toLowerCase().trim();
  const minute = matchState?.minute ?? 0;

  // Fontes 1ª/2ª: pressure_home/away (Futodds 0-100) e pressure_index_home/away (Sportmonks 0-100).
  // Quando ambos existem, usamos o MAIOR entre eles para o lado adversário (early-warning conservador)
  // e o MENOR para o nosso lado (não esconde fragilidade). Se só Sportmonks existir, ele substitui.
  const pHfut = Number(stats.pressure_home);
  const pAfut = Number(stats.pressure_away);
  const pHsm = Number(stats.pressure_index_home ?? stats.sportmonks_pressure_home);
  const pAsm = Number(stats.pressure_index_away ?? stats.sportmonks_pressure_away);
  const pickAdv = (fut: number, sm: number): number => {
    if (Number.isFinite(fut) && Number.isFinite(sm)) return Math.max(fut, sm);
    if (Number.isFinite(fut)) return fut;
    if (Number.isFinite(sm)) return sm;
    return NaN;
  };
  const pickOur = (fut: number, sm: number): number => {
    if (Number.isFinite(fut) && Number.isFinite(sm)) return Math.min(fut, sm);
    if (Number.isFinite(fut)) return fut;
    if (Number.isFinite(sm)) return sm;
    return NaN;
  };
  const pH = pickAdv(pHfut, pHsm); // será reinterpretado abaixo: aqui só garantimos numeric
  const pA = pickAdv(pAfut, pAsm);
  const pHOur = pickOur(pHfut, pHsm);
  const pAOur = pickOur(pAfut, pAsm);
  const smAgreement = Number.isFinite(pHsm) && Number.isFinite(pAsm); // se Sportmonks disponível
  const last5 = stats.last5min_stats;
  const last10 = stats.last10min_stats;
  if (!Number.isFinite(pH) && !Number.isFinite(pA) && !last5 && !last10) return null;


  const scoreH = matchState?.scoreHome ?? 0;
  const scoreA = matchState?.scoreAway ?? 0;
  const arr = (k: string, src: any) => Array.isArray(src?.[k]) ? src[k] : [0, 0];

  // ── BACK CASA / BACK FORA: pressão do lado contrário ──
  const isBackHome = /^(casa|home|1|back\s*casa)$/.test(market) || market.includes('back casa');
  const isBackAway = /^(fora|away|2|back\s*fora|back\s*visitante)$/.test(market) || market.includes('back fora');

  if (isBackHome || isBackAway) {
    const ourSide = isBackHome ? 'home' : 'away';
    const advSide = isBackHome ? 'away' : 'home';
    const pOur = isBackHome ? pH : pA;
    const pAdv = isBackHome ? pA : pH;
    const scoreOur = isBackHome ? scoreH : scoreA;
    const scoreAdv = isBackHome ? scoreA : scoreH;

    // Vencendo confortável? não emite alerta
    if (scoreOur - scoreAdv >= 2) return null;

    const reasons: string[] = [];
    let critical = false;

    // Critério 1: pressão adversária >= 65 com diferença >=15 (Futodds 0-100)
    if (Number.isFinite(pAdv) && Number.isFinite(pOur) && pAdv >= 65 && (pAdv - pOur) >= 15) {
      reasons.push(`Pressão adversária ${pAdv.toFixed(0)} vs ${pOur.toFixed(0)} (Δ${(pAdv - pOur).toFixed(0)})`);
      if (pAdv >= 75) critical = true;
    }

    // Critério 2: ataques perigosos últimos 5min muito desfavoráveis (3:1+)
    if (last5) {
      const [daH, daA] = arr('dangerous_attacks', last5);
      const daOur = isBackHome ? daH : daA;
      const daAdv = isBackHome ? daA : daH;
      if (daAdv >= 6 && daAdv >= daOur * 3) {
        reasons.push(`DA últ.5min ${daAdv} vs ${daOur}`);
        critical = true;
      }
    }

    // Critério 3: já está empatando ou perdendo + pressão adversária moderada
    if (scoreOur <= scoreAdv && Number.isFinite(pAdv) && pAdv >= 55 && (pAdv - pOur) >= 10) {
      reasons.push(`Placar ${scoreH}x${scoreA} sob pressão`);
    }

    if (reasons.length === 0) return null;
    if (critical) {
      return {
        triggered: true,
        severity: 'CRITICAL',
        signalType: 'BACK_PRESSURE_CRITICAL',
        motivo: `🚨 SAIR AGORA — Inversão de momentum contra ${isBackHome ? 'mandante' : 'visitante'}. (${reasons.join(' • ')})`,
        deltas: { pH, pA, ourSide, advSide, scoreH, scoreA, minute, reasons },
      };
    }
    return {
      triggered: true,
      severity: 'WARNING',
      signalType: 'BACK_PRESSURE_WARN',
      motivo: `⚠️ ATENÇÃO — Pressão adversária crescente. (${reasons.join(' • ')})`,
      deltas: { pH, pA, ourSide, advSide, scoreH, scoreA, minute, reasons },
    };
  }

  // ── OVER X.5: detecta jogo morto (sem ataques nos últimos 10min) com tempo escorrendo ──
  if (market.startsWith('over') && minute >= 60) {
    const line = parseFloat(market.replace(/over\s*/, '')) || 2.5;
    const golsAtuais = scoreH + scoreA;
    const golsFaltam = Math.ceil(line) - golsAtuais;
    if (golsFaltam <= 0) return null; // já bateu

    if (last10) {
      const [daH, daA] = arr('dangerous_attacks', last10);
      const [shH, shA] = arr('on_target', last10);
      const daTotal = (Number(daH) || 0) + (Number(daA) || 0);
      const shTotal = (Number(shH) || 0) + (Number(shA) || 0);
      const dead = daTotal < 4 && shTotal === 0;
      if (dead && minute >= 75) {
        return {
          triggered: true,
          severity: 'CRITICAL',
          signalType: 'OVER_DEAD_GAME',
          motivo: `🚨 SAIR AGORA — Jogo morto últ.10min (${daTotal} DA, ${shTotal} chutes a gol). Faltam ${golsFaltam} gol(s) para Over ${line} em ${90 - minute}min.`,
          deltas: { daTotal, shTotal, minute, golsFaltam, line },
        };
      }
      if (dead) {
        return {
          triggered: true,
          severity: 'WARNING',
          signalType: 'OVER_LOW_MOMENTUM',
          motivo: `⚠️ ATENÇÃO — Momentum baixo últ.10min (${daTotal} DA). Over ${line} em risco.`,
          deltas: { daTotal, shTotal, minute, golsFaltam, line },
        };
      }
    }
  }

  return null;
}

// ── Momentum Shift detection (last10 vs last20 Futodds) ──
// Detecta "jogo virando" antes do gol: compara últimos 10min com a janela
// anterior (10–20min). Se o lado adversário ao nosso bet ganhou >=40% de
// momentum (dangerous_attacks + on_target*3 + corners*2 + attacks*0.3) e
// agora supera o nosso lado → WARNING precoce.
function evaluateMomentumShift(
  pos: any,
  matchState: any,
): { triggered: boolean; severity: 'WARNING' | 'CRITICAL'; signalType: string; motivo: string; deltas?: any } | null {
  const stats: any = matchState?.stats || {};
  const market = String(pos.market || '').toLowerCase().trim();
  const minute = matchState?.minute ?? 0;
  if (minute < 20 || minute > 88) return null;

  const last10 = stats.last10min_stats;
  const last20 = stats.last20min_stats;
  if (!last10 || !last20) return null;

  const arr = (k: string, src: any) => Array.isArray(src?.[k]) ? src[k] : [0, 0];
  const score = (w: any, side: 'home' | 'away') => {
    const i = side === 'home' ? 0 : 1;
    const da = Number(arr('dangerous_attacks', w)[i]) || 0;
    const ot = Number(arr('on_target', w)[i]) || 0;
    const co = Number(arr('corners', w)[i]) || 0;
    const at = Number(arr('attacks', w)[i]) || 0;
    return da * 1.5 + ot * 3 + co * 2 + at * 0.3;
  };

  const isBackHome = /^(casa|home|1|back\s*casa)$/.test(market) || market.includes('back casa');
  const isBackAway = /^(fora|away|2|back\s*fora|back\s*visitante)$/.test(market) || market.includes('back fora');
  if (!isBackHome && !isBackAway) return null;

  const ourSide: 'home' | 'away' = isBackHome ? 'home' : 'away';
  const advSide: 'home' | 'away' = isBackHome ? 'away' : 'home';

  const scoreH = matchState?.scoreHome ?? 0;
  const scoreA = matchState?.scoreAway ?? 0;
  const scoreOur = isBackHome ? scoreH : scoreA;
  const scoreAdv = isBackHome ? scoreA : scoreH;
  if (scoreOur - scoreAdv >= 2) return null; // confortável

  // janelas: last10 = m-10..m ; prev10 = (last20 − last10) ≈ m-20..m-10
  const advL10 = score(last10, advSide);
  const advL20 = score(last20, advSide);
  const advPrev10 = Math.max(0, advL20 - advL10);
  const ourL10 = score(last10, ourSide);
  const ourL20 = score(last20, ourSide);
  const ourPrev10 = Math.max(0, ourL20 - ourL10);

  // ganho relativo do adversário (evita div/0 com base mínima)
  const base = Math.max(advPrev10, 5);
  const advGain = (advL10 - advPrev10) / base; // ex.: 0.4 = +40%
  const ourGain = (ourL10 - ourPrev10) / Math.max(ourPrev10, 5);

  // condições: adversário cresceu >=40% E agora supera nosso lado em momentum
  const flipped = advL10 > ourL10 * 1.2; // adv >20% acima de nós em mom. atual
  const big = advGain >= 0.4 && advGain - ourGain >= 0.3;
  if (!flipped || !big) return null;

  const motivoBase = `Adversário (${advSide}) +${(advGain * 100).toFixed(0)}% momentum últ.10min vs janela anterior — agora ${advL10.toFixed(0)} vs ${ourL10.toFixed(0)}.`;

  // severidade CRITICAL se já estamos perdendo OU adv ganho >=70%
  if (scoreOur < scoreAdv || advGain >= 0.7) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      signalType: 'MOMENTUM_SHIFT_CRITICAL',
      motivo: `🚨 SAIR AGORA — Jogo virando contra ${ourSide === 'home' ? 'mandante' : 'visitante'}. ${motivoBase}`,
      deltas: { advL10, advPrev10, ourL10, ourPrev10, advGain, ourGain, scoreH, scoreA, minute },
    };
  }
  return {
    triggered: true,
    severity: 'WARNING',
    signalType: 'MOMENTUM_SHIFT_WARN',
    motivo: `⚠️ ATENÇÃO — Jogo virando. ${motivoBase}`,
    deltas: { advL10, advPrev10, ourL10, ourPrev10, advGain, ourGain, scoreH, scoreA, minute },
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

    // Cache de thresholds personalizados por usuário (Map<userId, Map<line, threshold>>)
    const thresholdsCache = new Map<string, Map<number, UnderThreshold>>();
    async function getUserThreshold(uid: string, line: number): Promise<UnderThreshold | null> {
      if (!thresholdsCache.has(uid)) {
        const { data } = await supabase
          .from('under_cashout_thresholds')
          .select('under_line, delta_dangerous_attacks, delta_shots_on_target, delta_xg, enabled')
          .eq('user_id', uid);
        const m = new Map<number, UnderThreshold>();
        (data || []).forEach((r: any) => m.set(Number(r.under_line), {
          under_line: Number(r.under_line),
          delta_dangerous_attacks: r.delta_dangerous_attacks,
          delta_shots_on_target: r.delta_shots_on_target,
          delta_xg: Number(r.delta_xg),
          enabled: r.enabled,
        }));
        thresholdsCache.set(uid, m);
      }
      return thresholdsCache.get(uid)!.get(line) ?? null;
    }

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

        // ═══ REGRA UNDER X.5 — Cash Out Alert (prioritária, thresholds personalizados por usuário) ═══
        // Dispara antes da avaliação genérica para que a mensagem específica chegue ao usuário primeiro.
        const underLine = getUnderLine(pos.market || '');
        const userThreshold = (underLine != null && pos.user_id)
          ? await getUserThreshold(pos.user_id, underLine)
          : null;
        const u25 = evaluateUnderPressure(pos, liveMatch, userThreshold);
        if (u25?.triggered) {
          const placar = `${liveMatch.scoreHome ?? 0}-${liveMatch.scoreAway ?? 0}`;
          console.log(`[evaluate-cashout] 🛑 ${u25.signalType} ${pos.match_name} ${placar} min ${minuto} :: ${u25.motivo}`);

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
            // Telegram CRITICAL alert (fire-and-forget)
            if (u25.severity === 'CRITICAL') {
              supabase.functions.invoke('cashout-telegram-alert', { body: {
                bet_id: pos.id, signal_type: u25.signalType,
                match_name: pos.match_name, market: pos.market,
                placar, minuto,
                entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
                cashout_value: pos.cashout_value ?? pos.stake,
                motivo: u25.motivo,
              }}).catch((e) => console.warn('[evaluate-cashout] tg alert failed:', e?.message));
            }
          }
          // Não interrompe o fluxo — segue para a avaliação genérica abaixo,
          // mantendo current_odd/cashout_value atualizados (sem sobrescrever motivo).
        }

        // ═══ REGRA FUTODDS — Pressão adversa (Back Casa/Fora, Over) ═══
        // Roda quando Under não disparou. Usa pressure_indices + last5/last10 Futodds.
        let futoddsAlert: ReturnType<typeof evaluateFutoddsPressure> = null;
        if (!u25?.triggered) {
          futoddsAlert = evaluateFutoddsPressure(pos, liveMatch);
          if (futoddsAlert?.triggered) {
            const placar = `${liveMatch.scoreHome ?? 0}-${liveMatch.scoreAway ?? 0}`;
            console.log(`[evaluate-cashout] 🛑 ${futoddsAlert.signalType} ${pos.match_name} ${placar} min ${minuto} :: ${futoddsAlert.motivo}`);

            await supabase.from('virtual_bets').update({
              mycroft_cashout_signal: true,
              mycroft_cashout_reason: futoddsAlert.motivo,
              last_cashout_update: new Date().toISOString(),
            }).eq('id', pos.id);

            const { data: lastFutLog } = await supabase
              .from('cashout_signals_log')
              .select('id, signal_type, placar')
              .eq('bet_id', pos.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const sameFut = lastFutLog
              && lastFutLog.signal_type === futoddsAlert.signalType
              && lastFutLog.placar === placar;

            if (!sameFut) {
              await supabase.from('cashout_signals_log').insert({
                bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
                match_name: pos.match_name, market: pos.market,
                entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
                cashout_value: pos.cashout_value ?? pos.stake, stake: pos.stake,
                signal_type: futoddsAlert.signalType,
                position_health: futoddsAlert.severity,
                mycroft_reason: futoddsAlert.motivo,
                fatores: futoddsAlert.deltas ?? null,
                minuto, placar,
              });
              if (futoddsAlert.severity === 'CRITICAL') {
                supabase.functions.invoke('cashout-telegram-alert', { body: {
                  bet_id: pos.id, signal_type: futoddsAlert.signalType,
                  match_name: pos.match_name, market: pos.market,
                  placar, minuto,
                  entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
                  cashout_value: pos.cashout_value ?? pos.stake,
                  motivo: futoddsAlert.motivo,
                }}).catch((e) => console.warn('[evaluate-cashout] tg alert failed:', e?.message));
              }
            }
          }
        }


        // ═══ REGRA FUTODDS — Momentum Shift (jogo virando, last10 vs last20) ═══
        let shiftAlert: ReturnType<typeof evaluateMomentumShift> = null;
        if (!u25?.triggered && !futoddsAlert?.triggered) {
          shiftAlert = evaluateMomentumShift(pos, liveMatch);
          if (shiftAlert?.triggered) {
            const placar = `${liveMatch.scoreHome ?? 0}-${liveMatch.scoreAway ?? 0}`;
            console.log(`[evaluate-cashout] 🔄 ${shiftAlert.signalType} ${pos.match_name} ${placar} min ${minuto} :: ${shiftAlert.motivo}`);

            await supabase.from('virtual_bets').update({
              mycroft_cashout_signal: true,
              mycroft_cashout_reason: shiftAlert.motivo,
              last_cashout_update: new Date().toISOString(),
            }).eq('id', pos.id);

            const { data: lastShiftLog } = await supabase
              .from('cashout_signals_log')
              .select('id, signal_type, placar')
              .eq('bet_id', pos.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const sameShift = lastShiftLog
              && lastShiftLog.signal_type === shiftAlert.signalType
              && lastShiftLog.placar === placar;

            if (!sameShift) {
              await supabase.from('cashout_signals_log').insert({
                bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
                match_name: pos.match_name, market: pos.market,
                entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
                cashout_value: pos.cashout_value ?? pos.stake, stake: pos.stake,
                signal_type: shiftAlert.signalType,
                position_health: shiftAlert.severity,
                mycroft_reason: shiftAlert.motivo,
                fatores: shiftAlert.deltas ?? null,
                minuto, placar,
              });
              if (shiftAlert.severity === 'CRITICAL') {
                supabase.functions.invoke('cashout-telegram-alert', { body: {
                  bet_id: pos.id, signal_type: shiftAlert.signalType,
                  match_name: pos.match_name, market: pos.market,
                  placar, minuto,
                  entry_odd: entryOdd, current_odd: pos.current_odd ?? entryOdd,
                  cashout_value: pos.cashout_value ?? pos.stake,
                  motivo: shiftAlert.motivo,
                }}).catch((e) => console.warn('[evaluate-cashout] tg alert failed:', e?.message));
              }
            }
          }
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
        let oddFonte: string;
        let confianca = 0;
        let fatores: any = null;

        // Phase 3: Betfair Exchange (last_price_traded) → Futodds odds_live → estimador.
        const oddReal = await buscarOddRealDetalhe(pos);
        if (oddReal) {
          oddAtual = oddReal.odd; oddFonte = oddReal.fonte;
          confianca = oddReal.fonte === 'betfair_exchange' ? 100 : 95;
        } else {
          const est = estimarOdd(pos, statsCtx);
          oddAtual = est.odd; oddFonte = 'estimada'; confianca = est.confianca; fatores = est.fatores;
        }

        const cashoutValue = Math.round(Math.max(0, pos.stake * (entryOdd / oddAtual)) * 100) / 100;
        const { saude, sinal, motivo } = classificarSaude(pos, oddAtual, minuto);

        console.log(`[evaluate-cashout] ${pos.match_name} | @${entryOdd}→${oddAtual} | R$${cashoutValue} | ${saude} | signal=${sinal} | ${oddFonte}`);

        // Update position — Under 2.5 (u25) tem prioridade sobre a saúde genérica.
        const finalSinal = (u25?.triggered ?? false) || (futoddsAlert?.triggered ?? false) || (shiftAlert?.triggered ?? false) || sinal;
        const finalMotivo = u25?.triggered
          ? u25.motivo
          : (futoddsAlert?.triggered
            ? futoddsAlert.motivo
            : (shiftAlert?.triggered ? shiftAlert.motivo : (sinal ? motivo : null)));
        await supabase.from('virtual_bets').update({
          current_odd: oddAtual, cashout_value: cashoutValue, cashout_odd: oddAtual,
          odd_fonte: oddFonte,
          mycroft_cashout_signal: finalSinal,
          mycroft_cashout_reason: finalMotivo,
          last_cashout_update: new Date().toISOString(),
        }).eq('id', pos.id);

        // Histórico de auditoria por aposta — sempre grava cada tick avaliado.
        await supabase.from('cashout_history').insert({
          bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id, market: pos.market,
          entry_odd: entryOdd, current_odd: oddAtual, cashout_value: cashoutValue,
          fonte: oddFonte, confianca, saude, signal: sinal, motivo,
          fatores, minute: minuto,
          score: `${statsCtx.score_home}-${statsCtx.score_away}`,
        });

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
    await logEdgeError("evaluate-cashout", error).catch(() => {});
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
