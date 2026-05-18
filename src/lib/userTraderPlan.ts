/**
 * Plano Pessoal do usuário para Arena Trader Sports (ao vivo).
 * Modo paralelo: roda em cima dos jogos já carregados, no cliente.
 * Mycroft global continua aprovando os "Sinais Aprovados" — esta feature é uma
 * lista extra "Meus Sinais" baseada SOMENTE nos critérios do usuário.
 */

import type { LiveMatch } from '@/hooks/useLiveMatches';

export type UserMarket = '1x2' | 'over_under' | 'btts' | 'corners';
export type Outcome =
  | 'home' | 'away' | 'draw'
  | 'over' | 'under'
  | 'yes' | 'no'
  | 'corners_over';

export interface UserPlan {
  enabled: boolean;
  market: UserMarket;
  outcome: Outcome;
  /** Linha do mercado (Over 2.5 → 2.5; Corners Over 8.5 → 8.5). */
  line?: number;
  obrigatorios: {
    minuto_min: number;
    minuto_max: number;
    odd_min: number;
    odd_max: number;
    /** Diferença mínima de xG a favor do time apostado (não usado em over/under, btts). */
    xg_diff_min?: number;
    /** Posse mínima do time apostado (1x2). */
    posse_min?: number;
    /** Finalizações no gol mínimas (1x2 → do time; OU/BTTS → totais). */
    shots_on_target_min?: number;
  };
  reforco: {
    /** Diferença de ataques perigosos a favor (1x2). */
    ataques_perigosos_diff_min?: number;
    /** Placar permitido para 1x2: 'losing_by_1' | 'drawing' | 'winning'. */
    placar_permitido?: Array<'losing_by_1' | 'drawing' | 'winning_by_1' | 'winning_2plus'>;
  };
  vetos: {
    veto_time_vencendo?: boolean;
    veto_diff_2gols?: boolean;
    veto_xg_adversario_maior?: boolean;
    veto_apos_min?: number; // se minuto > este valor, veta
    veto_antes_min?: number;
  };
}

export type PlansByMarket = Partial<Record<UserMarket, UserPlan>>;

const STORAGE_KEY = 'arenaTraderSports.userPlans.v1';

export const DEFAULT_PLANS: PlansByMarket = {
  '1x2': {
    enabled: false,
    market: '1x2',
    outcome: 'home',
    obrigatorios: {
      minuto_min: 20,
      minuto_max: 75,
      odd_min: 1.4,
      odd_max: 3.0,
      xg_diff_min: 0.15,
      posse_min: 52,
      shots_on_target_min: 2,
    },
    reforco: {
      ataques_perigosos_diff_min: 3,
      placar_permitido: ['drawing', 'losing_by_1'],
    },
    vetos: {
      veto_time_vencendo: true,
      veto_diff_2gols: true,
      veto_xg_adversario_maior: true,
      veto_apos_min: 75,
    },
  },
  over_under: {
    enabled: false,
    market: 'over_under',
    outcome: 'over',
    line: 2.5,
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 70,
      odd_min: 1.4,
      odd_max: 3.0,
      shots_on_target_min: 4,
    },
    reforco: {},
    vetos: { veto_apos_min: 75 },
  },
  btts: {
    enabled: false,
    market: 'btts',
    outcome: 'yes',
    obrigatorios: {
      minuto_min: 15,
      minuto_max: 70,
      odd_min: 1.5,
      odd_max: 3.5,
      shots_on_target_min: 3,
    },
    reforco: {},
    vetos: { veto_apos_min: 75 },
  },
  corners: {
    enabled: false,
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

export function loadUserPlans(): PlansByMarket {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLANS;
    const parsed = JSON.parse(raw) as PlansByMarket;
    return { ...DEFAULT_PLANS, ...parsed };
  } catch {
    return DEFAULT_PLANS;
  }
}

export function saveUserPlans(p: PlansByMarket): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// ───────────────────────────── Evaluator ─────────────────────────────

export interface EvalResult {
  passed: boolean;
  reasons: string[];      // por que passou
  failed_by: string[];    // por que NÃO passou (ou veto)
  market_label: string;   // ex "1X2 · CASA"
  selected_odd: number | null;
  shouldShow: boolean;    // true se atende min/max minuto (para listar como elegível)
}

function pickOdd(lm: LiveMatch, plan: UserPlan): number | null {
  const od: any = (lm as any).odds_live ?? null;
  if (!od) return null;
  if (plan.market === '1x2') {
    if (plan.outcome === 'home') return od.home ?? null;
    if (plan.outcome === 'away') return od.away ?? null;
    if (plan.outcome === 'draw') return od.draw ?? null;
  }
  if (plan.market === 'over_under') {
    if (plan.outcome === 'over') return od.over25 ?? null;
    if (plan.outcome === 'under') return od.under25 ?? null;
  }
  // BTTS e corners: odd não vem no payload padrão, retorna null e o check de odd é skipado.
  return null;
}

function marketLabel(plan: UserPlan): string {
  if (plan.market === '1x2') {
    const out = plan.outcome === 'home' ? 'CASA' : plan.outcome === 'away' ? 'FORA' : 'EMPATE';
    return `1X2 · ${out}`;
  }
  if (plan.market === 'over_under') {
    return `${plan.outcome === 'over' ? 'OVER' : 'UNDER'} ${plan.line ?? 2.5} GOLS`;
  }
  if (plan.market === 'btts') {
    return `AMBAS MARCAM · ${plan.outcome === 'yes' ? 'SIM' : 'NÃO'}`;
  }
  return `ESCANTEIOS OVER ${plan.line ?? 8.5}`;
}

export function evaluatePlan(lm: LiveMatch, plan: UserPlan): EvalResult {
  const reasons: string[] = [];
  const failed: string[] = [];
  const s: any = lm.stats || {};
  const minute = lm.minute ?? 0;
  const sh = lm.score_home ?? 0;
  const sa = lm.score_away ?? 0;
  const oddPicked = pickOdd(lm, plan);
  const label = marketLabel(plan);

  const result: EvalResult = {
    passed: false,
    reasons,
    failed_by: failed,
    market_label: label,
    selected_odd: oddPicked,
    shouldShow: minute >= plan.obrigatorios.minuto_min && minute <= plan.obrigatorios.minuto_max,
  };

  // Janela de minuto
  if (minute < plan.obrigatorios.minuto_min) {
    failed.push(`Min ${minute} < ${plan.obrigatorios.minuto_min}`);
  } else {
    reasons.push(`Min ${minute} dentro da janela`);
  }
  if (minute > plan.obrigatorios.minuto_max) failed.push(`Min ${minute} > ${plan.obrigatorios.minuto_max}`);

  // Vetos
  if (plan.vetos.veto_apos_min && minute > plan.vetos.veto_apos_min) failed.push(`Veto: após ${plan.vetos.veto_apos_min}'`);
  if (plan.vetos.veto_antes_min && minute < plan.vetos.veto_antes_min) failed.push(`Veto: antes de ${plan.vetos.veto_antes_min}'`);

  // Odd
  if (oddPicked != null) {
    if (oddPicked < plan.obrigatorios.odd_min) failed.push(`Odd ${oddPicked.toFixed(2)} < ${plan.obrigatorios.odd_min}`);
    else if (oddPicked > plan.obrigatorios.odd_max) failed.push(`Odd ${oddPicked.toFixed(2)} > ${plan.obrigatorios.odd_max}`);
    else reasons.push(`Odd ${oddPicked.toFixed(2)} ok`);
  } else if (plan.market === '1x2' || plan.market === 'over_under') {
    failed.push('Sem odd ao vivo');
  }

  // ============ Específico por mercado ============
  if (plan.market === '1x2') {
    const isHome = plan.outcome === 'home';
    const isDraw = plan.outcome === 'draw';
    const meXg = isHome ? (s.xG_home ?? s.xg_home ?? 0) : (s.xG_away ?? s.xg_away ?? 0);
    const advXg = isHome ? (s.xG_away ?? s.xg_away ?? 0) : (s.xG_home ?? s.xg_home ?? 0);
    const mePoss = isHome ? (s.possession_home ?? 0) : (s.possession_away ?? 0);
    const meShots = isHome ? (s.shots_on_target_home ?? s.shots_home ?? 0) : (s.shots_on_target_away ?? s.shots_away ?? 0);
    const meAtaq = isHome ? (s.dangerous_attacks_home ?? s.attacks_home ?? 0) : (s.dangerous_attacks_away ?? s.attacks_away ?? 0);
    const advAtaq = isHome ? (s.dangerous_attacks_away ?? s.attacks_away ?? 0) : (s.dangerous_attacks_home ?? s.attacks_home ?? 0);

    const myScore = isHome ? sh : sa;
    const advScore = isHome ? sa : sh;
    const diff = myScore - advScore;

    if (!isDraw) {
      // vetos de placar
      if (plan.vetos.veto_time_vencendo && diff > 0) failed.push('Veto: time vencendo');
      if (plan.vetos.veto_diff_2gols && Math.abs(diff) >= 2) failed.push('Veto: diferença ≥ 2 gols');
      if (plan.vetos.veto_xg_adversario_maior && advXg > meXg) failed.push(`Veto: xG adv ${advXg.toFixed(2)} > meu ${meXg.toFixed(2)}`);

      // obrigatórios
      if (plan.obrigatorios.xg_diff_min != null) {
        const xgDiff = meXg - advXg;
        if (xgDiff < plan.obrigatorios.xg_diff_min) failed.push(`xG diff ${xgDiff.toFixed(2)} < ${plan.obrigatorios.xg_diff_min}`);
        else reasons.push(`xG +${xgDiff.toFixed(2)}`);
      }
      if (plan.obrigatorios.posse_min != null) {
        if (mePoss < plan.obrigatorios.posse_min) failed.push(`Posse ${mePoss}% < ${plan.obrigatorios.posse_min}%`);
        else reasons.push(`Posse ${mePoss}%`);
      }
      if (plan.obrigatorios.shots_on_target_min != null) {
        if (meShots < plan.obrigatorios.shots_on_target_min) failed.push(`SoT ${meShots} < ${plan.obrigatorios.shots_on_target_min}`);
        else reasons.push(`SoT ${meShots}`);
      }

      // reforço
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
    const sotTotal = (s.shots_on_target_home ?? s.shots_home ?? 0) + (s.shots_on_target_away ?? s.shots_away ?? 0);
    if (plan.obrigatorios.shots_on_target_min != null) {
      if (plan.outcome === 'over' && sotTotal < plan.obrigatorios.shots_on_target_min) failed.push(`SoT total ${sotTotal} < ${plan.obrigatorios.shots_on_target_min}`);
      else reasons.push(`SoT total ${sotTotal}`);
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
      if (sotH < min || sotA < min) failed.push(`SoT min por lado ${min} (${sotH}/${sotA})`);
      else reasons.push(`SoT ${sotH}/${sotA}`);
    }
  }

  if (plan.market === 'corners') {
    const cornersTotal = (s.corners_home ?? 0) + (s.corners_away ?? 0);
    const line = plan.line ?? 8.5;
    if (cornersTotal > line) failed.push(`Linha já batida (${cornersTotal} > ${line})`);
    else reasons.push(`Escanteios atuais: ${cornersTotal}`);
    // Ritmo: precisa de 0.1 esc/min para chegar lá em 90'
    if (minute > 30) {
      const rate = cornersTotal / minute;
      const proj = rate * 90;
      if (proj < line) failed.push(`Ritmo baixo (proj ${proj.toFixed(1)} < ${line})`);
    }
  }

  result.passed = failed.length === 0;
  return result;
}
