/**
 * Plano Pessoal do usuário para Arena Trader Sports (ao vivo).
 *
 * v2 — múltiplos planos NOMEADOS por usuário. Cada plano tem um id + nome,
 * o mercado-alvo, o outcome e os critérios. O usuário pode criar quantos
 * planos quiser (ex.: "Back Favorito Casa", "Over 1.5 HT", "BTTS conservador").
 *
 * Persistência:
 *  - Supabase (user_trader_plans_v2) é fonte da verdade quando logado.
 *  - localStorage funciona como cache offline / fallback anônimo.
 */

import type { LiveMatch } from '@/hooks/useLiveMatches';
import { supabase } from '@/integrations/supabase/client';

export type UserMarket = '1x2' | 'over_under' | 'btts' | 'corners';
export type Outcome =
  | 'home' | 'away' | 'draw'
  | 'over' | 'under'
  | 'yes' | 'no'
  | 'corners_over';

export interface UserPlanCriteria {
  market: UserMarket;
  outcome: Outcome;
  line?: number;
  obrigatorios: {
    minuto_min: number;
    minuto_max: number;
    odd_min: number;
    odd_max: number;
    xg_diff_min?: number;
    posse_min?: number;
    shots_on_target_min?: number;
    posse_diff_min?: number;
    shots_total_min?: number;
    shots_on_target_total_min?: number;
    corners_total_min?: number;
    red_cards_adv_min?: number;
  };
  reforco: {
    ataques_perigosos_diff_min?: number;
    placar_permitido?: Array<'losing_by_1' | 'drawing' | 'winning_by_1' | 'winning_2plus'>;
  };
  vetos: {
    veto_time_vencendo?: boolean;
    veto_diff_2gols?: boolean;
    veto_xg_adversario_maior?: boolean;
    veto_apos_min?: number;
    veto_antes_min?: number;
  };
}

export interface UserPlan extends UserPlanCriteria {
  id: string;
  name: string;
  enabled: boolean;
}

export type PlanTier = 'APROVADO' | 'APROVADO_CONF_REDUZIDA';
export type PlanVisibility = 'private' | 'public';

const STORAGE_KEY = 'arenaTraderSports.userPlans.v2';
const VISIBILITY_KEY = 'arenaTraderSports.userPlans.visibility.v1';

// ───────────────────────────── Templates ─────────────────────────────

export const PLAN_TEMPLATES: Record<string, Omit<UserPlan, 'id'>> = {
  back_favorito: {
    name: 'Back Favorito (permissivo)',
    enabled: true,
    market: '1x2',
    outcome: 'home',
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 75,
      odd_min: 1.40,
      odd_max: 2.20,
      xg_diff_min: 0,
      posse_min: 50,
      shots_on_target_min: 1,
    },
    reforco: {
      ataques_perigosos_diff_min: 2,
      placar_permitido: ['drawing', 'losing_by_1', 'winning_by_1'],
    },
    vetos: {
      veto_time_vencendo: false,
      veto_diff_2gols: true,
      veto_xg_adversario_maior: false,
      veto_apos_min: 80,
    },
  },
  back_dominante: {
    name: 'Back Dominante (criterioso)',
    enabled: true,
    market: '1x2',
    outcome: 'home',
    obrigatorios: {
      minuto_min: 20,
      minuto_max: 75,
      odd_min: 1.5,
      odd_max: 3.0,
      xg_diff_min: 0.3,
      posse_min: 55,
      shots_on_target_min: 3,
      posse_diff_min: 10,
    },
    reforco: {
      ataques_perigosos_diff_min: 5,
      placar_permitido: ['drawing', 'losing_by_1'],
    },
    vetos: {
      veto_time_vencendo: true,
      veto_diff_2gols: true,
      veto_xg_adversario_maior: true,
      veto_apos_min: 75,
    },
  },
  over_15_ht: {
    name: 'Over 1.5 HT',
    enabled: true,
    market: 'over_under',
    outcome: 'over',
    line: 1.5,
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 40,
      odd_min: 1.50,
      odd_max: 3.50,
      shots_on_target_min: 3,
      shots_total_min: 6,
    },
    reforco: {},
    vetos: { veto_apos_min: 42 },
  },
  over_25_ft: {
    name: 'Over 2.5 FT',
    enabled: true,
    market: 'over_under',
    outcome: 'over',
    line: 2.5,
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 65,
      odd_min: 1.40,
      odd_max: 3.0,
      shots_on_target_min: 5,
    },
    reforco: {},
    vetos: { veto_apos_min: 70 },
  },
  btts_yes: {
    name: 'BTTS Sim',
    enabled: true,
    market: 'btts',
    outcome: 'yes',
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 70,
      odd_min: 1.5,
      odd_max: 3.5,
      shots_on_target_min: 2,
    },
    reforco: {},
    vetos: { veto_apos_min: 75 },
  },
  corners_over: {
    name: 'Escanteios Over 8.5',
    enabled: true,
    market: 'corners',
    outcome: 'corners_over',
    line: 8.5,
    obrigatorios: {
      minuto_min: 20,
      minuto_max: 75,
      odd_min: 1.5,
      odd_max: 3.5,
    },
    reforco: {},
    vetos: { veto_apos_min: 80 },
  },
};

export function createPlanFromTemplate(templateKey: keyof typeof PLAN_TEMPLATES): UserPlan {
  const t = PLAN_TEMPLATES[templateKey];
  return { ...t, id: cryptoId() };
}

export function createEmptyPlan(market: UserMarket): UserPlan {
  const defaults: Record<UserMarket, UserPlanCriteria> = {
    '1x2': { market: '1x2', outcome: 'home', obrigatorios: { minuto_min: 20, minuto_max: 75, odd_min: 1.4, odd_max: 3.0 }, reforco: {}, vetos: {} },
    over_under: { market: 'over_under', outcome: 'over', line: 2.5, obrigatorios: { minuto_min: 15, minuto_max: 70, odd_min: 1.4, odd_max: 3.0 }, reforco: {}, vetos: {} },
    btts: { market: 'btts', outcome: 'yes', obrigatorios: { minuto_min: 15, minuto_max: 70, odd_min: 1.5, odd_max: 3.5 }, reforco: {}, vetos: {} },
    corners: { market: 'corners', outcome: 'corners_over', line: 8.5, obrigatorios: { minuto_min: 20, minuto_max: 75, odd_min: 1.5, odd_max: 3.5 }, reforco: {}, vetos: {} },
  };
  return { id: cryptoId(), name: 'Novo plano', enabled: true, ...defaults[market] };
}

function cryptoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

// ───────────────────────────── Visibility ─────────────────────────────

export function loadPlanVisibility(): PlanVisibility {
  try {
    const raw = window.localStorage.getItem(VISIBILITY_KEY);
    return raw === 'public' ? 'public' : 'private';
  } catch {
    return 'private';
  }
}

export function savePlanVisibility(v: PlanVisibility): void {
  try { window.localStorage.setItem(VISIBILITY_KEY, v); } catch { /* ignore */ }
  void syncVisibilityToSupabase(v);
}

async function syncVisibilityToSupabase(v: PlanVisibility): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_trader_plans_v2').update({ visibility: v }).eq('user_id', user.id);
  } catch (e) {
    console.warn('[userTraderPlan] syncVisibility falhou:', e);
  }
}

// ───────────────────────────── CRUD ─────────────────────────────

function readLocal(): UserPlan[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && p.id && p.name && p.market);
  } catch { return []; }
}

function writeLocal(plans: UserPlan[]): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); } catch { /* ignore */ }
}

/** Carrega todos os planos do usuário (Supabase quando logado, localStorage como fallback/cache). */
export async function loadUserPlans(): Promise<UserPlan[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_trader_plans_v2')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        ...(r.plan as UserPlanCriteria),
        id: r.id,
        name: r.name,
        enabled: r.enabled,
      })) as UserPlan[];
      writeLocal(rows);
      return rows;
    }
  } catch (e) {
    console.warn('[userTraderPlan] loadUserPlans Supabase falhou, usando cache local', e);
  }
  return readLocal();
}

/** Versão sincrona (cache local) — para uso em components que precisam de valor inicial sem await. */
export function loadUserPlansSync(): UserPlan[] {
  return readLocal();
}

/** Cria ou atualiza UM plano. */
export async function saveUserPlan(plan: UserPlan): Promise<UserPlan> {
  const all = readLocal();
  const idx = all.findIndex((p) => p.id === plan.id);
  if (idx >= 0) all[idx] = plan; else all.push(plan);
  writeLocal(all);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const visibility = loadPlanVisibility();
      const { market, outcome, line, obrigatorios, reforco, vetos } = plan;
      const planBody: UserPlanCriteria = { market, outcome, line, obrigatorios, reforco, vetos };
      await supabase.from('user_trader_plans_v2').upsert({
        id: plan.id,
        user_id: user.id,
        name: plan.name,
        market: plan.market,
        plan: planBody as any,
        enabled: plan.enabled,
        visibility,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('[userTraderPlan] saveUserPlan sync falhou:', e);
  }
  return plan;
}

export async function deleteUserPlan(id: string): Promise<void> {
  const all = readLocal().filter((p) => p.id !== id);
  writeLocal(all);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('user_trader_plans_v2').delete().eq('id', id).eq('user_id', user.id);
  } catch (e) {
    console.warn('[userTraderPlan] deleteUserPlan sync falhou:', e);
  }
}

export async function duplicateUserPlan(id: string): Promise<UserPlan | null> {
  const all = readLocal();
  const src = all.find((p) => p.id === id);
  if (!src) return null;
  const copy: UserPlan = { ...src, id: cryptoId(), name: `${src.name} (cópia)` };
  await saveUserPlan(copy);
  return copy;
}

/** Loga um sinal aprovado pelo plano pessoal (idempotente por user+match+plan_id). */
export async function logUserPlanSignal(params: {
  match_id: string;
  match_name: string;
  league: string;
  market: UserMarket;
  outcome: Outcome;
  line: number | null;
  market_label: string;
  selected_odd: number | null;
  minute: number;
  reasons: string[];
  commence_time?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_trader_plan_signals').upsert(
      {
        user_id: user.id,
        match_id: params.match_id,
        match_name: params.match_name,
        league: params.league,
        market: params.market,
        outcome: params.outcome,
        line: params.line,
        market_label: params.market_label,
        selected_odd: params.selected_odd,
        minute: params.minute,
        reasons: params.reasons,
        commence_time: params.commence_time ?? null,
        plan_id: params.plan_id ?? null,
        plan_name: params.plan_name ?? null,
      },
      { onConflict: 'user_id,match_id,market,outcome', ignoreDuplicates: true },
    );
  } catch (e) {
    console.warn('[userTraderPlan] logUserPlanSignal falhou:', e);
  }
}

// ───────────────────────────── Evaluator ─────────────────────────────

export interface EvalResult {
  passed: boolean;
  reasons: string[];
  failed_by: string[];
  market_label: string;
  selected_odd: number | null;
  shouldShow: boolean;
  tier: PlanTier;
  missing_stats: string[];
}

// Odds-live (Futodds/Betfair) por mercado. Para corners não há odd live integrada
// na pipeline atual; usamos o valor médio histórico do mercado Over 8.5 como
// proxy (~1.85) para que o cálculo de ROI não fique zerado em GREEN.
const CORNERS_OVER_FALLBACK_ODD = 1.85;
const BTTS_FALLBACK_ODD = 1.82;
function pickOdd(lm: LiveMatch, plan: UserPlanCriteria): number | null {
  const od: any = (lm as any).odds_live ?? null;
  if (plan.market === '1x2') {
    if (!od) return null;
    if (plan.outcome === 'home') return od.home ?? null;
    if (plan.outcome === 'away') return od.away ?? null;
    if (plan.outcome === 'draw') return od.draw ?? null;
  }
  if (plan.market === 'over_under') {
    if (!od) return null;
    if (plan.outcome === 'over') return od.over25 ?? null;
    if (plan.outcome === 'under') return od.under25 ?? null;
  }
  if (plan.market === 'btts') {
    const live = od ? (plan.outcome === 'yes' ? od.btts_yes : od.btts_no) : null;
    return (live != null && Number(live) > 1) ? Number(live) : BTTS_FALLBACK_ODD;
  }
  if (plan.market === 'corners') {
    return CORNERS_OVER_FALLBACK_ODD;
  }
  return null;
}

function marketLabel(plan: UserPlanCriteria): string {
  if (plan.market === '1x2') {
    const out = plan.outcome === 'home' ? 'CASA' : plan.outcome === 'away' ? 'FORA' : 'EMPATE';
    return `1X2 · ${out}`;
  }
  if (plan.market === 'over_under') return `${plan.outcome === 'over' ? 'OVER' : 'UNDER'} ${plan.line ?? 2.5} GOLS`;
  if (plan.market === 'btts') return `AMBAS MARCAM · ${plan.outcome === 'yes' ? 'SIM' : 'NÃO'}`;
  return `ESCANTEIOS OVER ${plan.line ?? 8.5}`;
}

export function evaluatePlan(lm: LiveMatch, plan: UserPlanCriteria): EvalResult {
  const reasons: string[] = [];
  const failed: string[] = [];
  const s: any = lm.stats || {};
  const minute = lm.minute ?? 0;
  const sh = lm.score_home ?? 0;
  const sa = lm.score_away ?? 0;
  const oddPicked = pickOdd(lm, plan);
  const label = marketLabel(plan);

  const missing: string[] = [];
  const result: EvalResult = {
    passed: false,
    reasons,
    failed_by: failed,
    market_label: label,
    selected_odd: oddPicked,
    shouldShow: minute >= plan.obrigatorios.minuto_min && minute <= plan.obrigatorios.minuto_max,
    tier: 'APROVADO',
    missing_stats: missing,
  };

  const softCheckStat = (
    rawValue: number | null | undefined,
    threshold: number,
    label: string,
    fmt?: (v: number) => string,
  ) => {
    const v = rawValue == null ? 0 : Number(rawValue);
    if (!Number.isFinite(v) || v === 0) { missing.push(label); return; }
    if (v < threshold) failed.push(`${label} ${fmt ? fmt(v) : v} < ${threshold}`);
    else reasons.push(`${label} ${fmt ? fmt(v) : v} ✓`);
  };

  if (minute < plan.obrigatorios.minuto_min) failed.push(`Min ${minute} < ${plan.obrigatorios.minuto_min}`);
  else reasons.push(`Min ${minute} dentro da janela`);
  if (minute > plan.obrigatorios.minuto_max) failed.push(`Min ${minute} > ${plan.obrigatorios.minuto_max}`);

  if (plan.vetos.veto_apos_min && minute > plan.vetos.veto_apos_min) failed.push(`Veto: após ${plan.vetos.veto_apos_min}'`);
  if (plan.vetos.veto_antes_min && minute < plan.vetos.veto_antes_min) failed.push(`Veto: antes de ${plan.vetos.veto_antes_min}'`);

  if (oddPicked != null) {
    if (oddPicked < plan.obrigatorios.odd_min) failed.push(`Odd ${oddPicked.toFixed(2)} < ${plan.obrigatorios.odd_min}`);
    else if (oddPicked > plan.obrigatorios.odd_max) failed.push(`Odd ${oddPicked.toFixed(2)} > ${plan.obrigatorios.odd_max}`);
    else reasons.push(`Odd ${oddPicked.toFixed(2)} ok`);
  } else if (plan.market === '1x2' || plan.market === 'over_under') {
    failed.push('Sem odd ao vivo');
  }

  const possH = Number(s.possession_home ?? 0);
  const possA = Number(s.possession_away ?? 0);
  const shotsTotal = Number(s.shots_home ?? 0) + Number(s.shots_away ?? 0);
  const sotTotal = Number(s.shots_on_target_home ?? 0) + Number(s.shots_on_target_away ?? 0);
  const cornersTotal = Number(s.corners_home ?? 0) + Number(s.corners_away ?? 0);
  const redH = Number(s.red_cards_home ?? s.redcards_home ?? 0);
  const redA = Number(s.red_cards_away ?? s.redcards_away ?? 0);

  if (plan.obrigatorios.shots_total_min != null) softCheckStat(shotsTotal, plan.obrigatorios.shots_total_min, 'Chutes totais');
  if (plan.obrigatorios.shots_on_target_total_min != null) softCheckStat(sotTotal, plan.obrigatorios.shots_on_target_total_min, 'Chutes no gol (total)');
  if (plan.obrigatorios.corners_total_min != null) softCheckStat(cornersTotal, plan.obrigatorios.corners_total_min, 'Escanteios (total)');

  if (plan.market === '1x2') {
    const isHome = plan.outcome === 'home';
    const isDraw = plan.outcome === 'draw';
    const meXg = isHome ? (s.xG_home ?? s.xg_home ?? 0) : (s.xG_away ?? s.xg_away ?? 0);
    const advXg = isHome ? (s.xG_away ?? s.xg_away ?? 0) : (s.xG_home ?? s.xg_home ?? 0);
    const mePoss = isHome ? possH : possA;
    const meShots = isHome ? (s.shots_on_target_home ?? s.shots_home ?? 0) : (s.shots_on_target_away ?? s.shots_away ?? 0);
    const meAtaq = isHome ? (s.dangerous_attacks_home ?? s.attacks_home ?? 0) : (s.dangerous_attacks_away ?? s.attacks_away ?? 0);
    const advAtaq = isHome ? (s.dangerous_attacks_away ?? s.attacks_away ?? 0) : (s.dangerous_attacks_home ?? s.attacks_home ?? 0);
    const advRed = isHome ? redA : redH;
    const myScore = isHome ? sh : sa;
    const advScore = isHome ? sa : sh;
    const diff = myScore - advScore;

    if (!isDraw) {
      if (plan.vetos.veto_time_vencendo && diff > 0) failed.push('Veto: time vencendo');
      if (plan.vetos.veto_diff_2gols && Math.abs(diff) >= 2) failed.push('Veto: diferença ≥ 2 gols');
      if (plan.vetos.veto_xg_adversario_maior && advXg > meXg) failed.push(`Veto: xG adv ${advXg.toFixed(2)} > meu ${meXg.toFixed(2)}`);

      if (plan.obrigatorios.xg_diff_min != null) {
        const xgDiff = meXg - advXg;
        if (meXg === 0 && advXg === 0) missing.push('xG');
        else if (xgDiff < plan.obrigatorios.xg_diff_min) failed.push(`xG diff ${xgDiff.toFixed(2)} < ${plan.obrigatorios.xg_diff_min}`);
        else reasons.push(`xG +${xgDiff.toFixed(2)}`);
      }
      if (plan.obrigatorios.posse_min != null) softCheckStat(mePoss, plan.obrigatorios.posse_min, 'Posse', (v) => `${v}%`);
      if (plan.obrigatorios.shots_on_target_min != null) softCheckStat(meShots, plan.obrigatorios.shots_on_target_min, 'SoT (time)');

      if (plan.obrigatorios.posse_diff_min != null) {
        if (possH === 0 && possA === 0) missing.push('Diferença de posse');
        else {
          const pd = possH - possA;
          const sign = isHome ? pd : -pd;
          if (sign < plan.obrigatorios.posse_diff_min) failed.push(`Δ posse ${sign}pp < ${plan.obrigatorios.posse_diff_min}pp`);
          else reasons.push(`Δ posse ${sign}pp ✓`);
        }
      }

      if (plan.obrigatorios.red_cards_adv_min != null) {
        if (advRed < plan.obrigatorios.red_cards_adv_min) {
          if (redH === 0 && redA === 0) missing.push('Cartões vermelhos');
          else failed.push(`Vermelhos adv ${advRed} < ${plan.obrigatorios.red_cards_adv_min}`);
        } else reasons.push(`Vermelhos adv ${advRed} ✓`);
      }

      if (plan.reforco.ataques_perigosos_diff_min != null) {
        const ad = meAtaq - advAtaq;
        if (ad >= plan.reforco.ataques_perigosos_diff_min) reasons.push(`Ataques +${ad}`);
      }
      if (plan.reforco.placar_permitido?.length) {
        const tag = diff === 0 ? 'drawing' : diff === -1 ? 'losing_by_1' : diff === 1 ? 'winning_by_1' : diff >= 2 ? 'winning_2plus' : 'losing_by_1';
        if (!plan.reforco.placar_permitido.includes(tag as any)) failed.push(`Placar ${diff} não permitido`);
        else reasons.push(`Placar ok (${tag})`);
      }
    }
  }

  if (plan.market === 'over_under') {
    const gols = sh + sa;
    const line = plan.line ?? 2.5;
    if (plan.outcome === 'over' && gols > line) failed.push(`Linha já batida (${gols} > ${line})`);
    if (plan.outcome === 'under' && gols >= Math.ceil(line)) failed.push(`Já ${gols} gols`);
    if (plan.obrigatorios.shots_on_target_min != null) {
      if (plan.outcome === 'over') softCheckStat(sotTotal, plan.obrigatorios.shots_on_target_min, 'SoT total');
      else reasons.push(`SoT total ${sotTotal}`);
    }
    if (plan.obrigatorios.red_cards_adv_min != null) {
      const total = redH + redA;
      if (total < plan.obrigatorios.red_cards_adv_min) {
        if (total === 0) missing.push('Cartões vermelhos');
        else failed.push(`Vermelhos ${total} < ${plan.obrigatorios.red_cards_adv_min}`);
      } else reasons.push(`Vermelhos ${total} ✓`);
    }
  }

  if (plan.market === 'btts') {
    if (plan.outcome === 'yes') {
      if (sh > 0 && sa > 0) failed.push('BTTS já bateu');
      if (sh === 0 && sa === 0 && minute > 60) failed.push('0x0 e jogo morto');
    }
    const sotH = s.shots_on_target_home ?? s.shots_home ?? 0;
    const sotA = s.shots_on_target_away ?? s.shots_away ?? 0;
    if (plan.obrigatorios.shots_on_target_min != null) {
      const min = plan.obrigatorios.shots_on_target_min;
      if (sotH === 0 && sotA === 0) missing.push('Chutes no gol por lado');
      else if (sotH < min || sotA < min) failed.push(`SoT min por lado ${min} (${sotH}/${sotA})`);
      else reasons.push(`SoT ${sotH}/${sotA}`);
    }
  }

  if (plan.market === 'corners') {
    const line = plan.line ?? 8.5;
    if (cornersTotal > line) failed.push(`Linha já batida (${cornersTotal} > ${line})`);
    else if (cornersTotal > 0) reasons.push(`Escanteios atuais: ${cornersTotal}`);
    if (minute > 30 && cornersTotal > 0) {
      const rate = cornersTotal / minute;
      const proj = rate * 90;
      if (proj < line) failed.push(`Ritmo baixo (proj ${proj.toFixed(1)} < ${line})`);
    } else if (minute > 30 && cornersTotal === 0) {
      missing.push('Escanteios');
    }
  }

  result.passed = failed.length === 0;
  result.tier = result.passed && missing.length > 0 ? 'APROVADO_CONF_REDUZIDA' : 'APROVADO';
  return result;
}
