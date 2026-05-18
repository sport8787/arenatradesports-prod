// ═══════════════════════════════════════════════════════════════
// PUNTER APPROVAL BLOCKS — gate determinístico pós-IA
// ───────────────────────────────────────────────────────────────
// Aplica sistema de 3 blocos (A/B/C) + vetos determinísticos.
// Thresholds vêm da tabela `punter_gate_config` (linha 'global'),
// com fallback para variáveis de ambiente e, por fim, defaults.
// Permite ajustar regras sem redeploy.
// ═══════════════════════════════════════════════════════════════

export type BlockTier = "A" | "B" | "C" | null;

export interface BlockGateInput {
  verdict: string;
  market: string | null | undefined;
  odd: number | null | undefined;
  estimated_probability: number | null | undefined; // 0-100
  value_percentage: number | null | undefined;      // edge em %
  confidence: number | null | undefined;            // 0-100
  league?: string | null;
  bookmaker?: string | null;
  data_strength?: string | null;
  odd_drop_pct_2h?: number | null;
}

export interface BlockGateResult {
  verdict: "APROVADO" | "VETADO";
  block: BlockTier;
  tier_label: string;
  stake_percentage: number;
  veto_reason?: string;
  demoted?: boolean;
  block_reason?: string;
}

export interface GateConfig {
  prob_min_global: number;
  odd_min_global: number;
  odd_max_global: number;
  favorite_odd_threshold: number;
  favorite_requires_data_strength: string;
  odd_drop_pct_threshold: number;
  weak_league_odd_threshold: number;
  strong_league_regex: string;
  conf_inflation_threshold: number;
  edge_inflation_threshold: number;
  a_prob_min: number; a_edge_min: number; a_conf_min: number;
  a_odd_min: number; a_odd_max: number; a_stake_pct: number;
  b_prob_min: number; b_edge_min: number; b_conf_min: number;
  b_odd_min: number; b_odd_max: number; b_stake_pct: number;
  c_prob_min: number; c_edge_min: number; c_conf_min: number;
  c_odd_min: number; c_odd_max: number; c_stake_pct: number;
  c_requires_pinnacle: boolean;
  enabled: boolean;
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  prob_min_global: 45,
  odd_min_global: 1.30,
  odd_max_global: 4.50,
  favorite_odd_threshold: 1.50,
  favorite_requires_data_strength: "ALTA",
  odd_drop_pct_threshold: 8,
  weak_league_odd_threshold: 1.60,
  strong_league_regex: "(premier league|la liga|primera divis|serie a|bundesliga|ligue 1|champions|europa|conference|libertadores|sudamericana|brasileir|copa do brasil|eredivisie|primeira liga|jupiler|championship|copa america|world cup|euro)",
  conf_inflation_threshold: 85,
  edge_inflation_threshold: 5,
  a_prob_min: 58, a_edge_min: 3, a_conf_min: 72, a_odd_min: 1.30, a_odd_max: 1.85, a_stake_pct: 2,
  b_prob_min: 45, b_edge_min: 5, b_conf_min: 70, b_odd_min: 1.85, b_odd_max: 3.20, b_stake_pct: 3,
  c_prob_min: 55, c_edge_min: 7, c_conf_min: 80, c_odd_min: 1.50, c_odd_max: 4.50, c_stake_pct: 4,
  c_requires_pinnacle: true,
  enabled: true,
};

// ─── ENV OVERRIDES (camada intermediária) ───
function envNum(key: string): number | undefined {
  try {
    // @ts-ignore Deno
    const v = (globalThis as any).Deno?.env?.get?.(key);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  } catch { return undefined; }
}
function envStr(key: string): string | undefined {
  try {
    // @ts-ignore Deno
    const v = (globalThis as any).Deno?.env?.get?.(key);
    return (v == null || v === "") ? undefined : String(v);
  } catch { return undefined; }
}

function applyEnvOverrides(cfg: GateConfig): GateConfig {
  const num = (k: keyof GateConfig, env: string) => {
    const v = envNum(env); if (v !== undefined) (cfg as any)[k] = v;
  };
  const str = (k: keyof GateConfig, env: string) => {
    const v = envStr(env); if (v !== undefined) (cfg as any)[k] = v;
  };
  num("prob_min_global", "GATE_PROB_MIN_GLOBAL");
  num("odd_min_global", "GATE_ODD_MIN_GLOBAL");
  num("odd_max_global", "GATE_ODD_MAX_GLOBAL");
  num("favorite_odd_threshold", "GATE_FAVORITE_ODD_THRESHOLD");
  str("favorite_requires_data_strength", "GATE_FAVORITE_REQUIRES_DATA_STRENGTH");
  num("odd_drop_pct_threshold", "GATE_ODD_DROP_PCT_THRESHOLD");
  num("weak_league_odd_threshold", "GATE_WEAK_LEAGUE_ODD_THRESHOLD");
  str("strong_league_regex", "GATE_STRONG_LEAGUE_REGEX");
  num("conf_inflation_threshold", "GATE_CONF_INFLATION_THRESHOLD");
  num("edge_inflation_threshold", "GATE_EDGE_INFLATION_THRESHOLD");
  (["a","b","c"] as const).forEach(b => {
    (["prob_min","edge_min","conf_min","odd_min","odd_max","stake_pct"] as const).forEach(f => {
      num(`${b}_${f}` as keyof GateConfig, `GATE_${b.toUpperCase()}_${f.toUpperCase()}`);
    });
  });
  const reqPin = envStr("GATE_C_REQUIRES_PINNACLE");
  if (reqPin !== undefined) cfg.c_requires_pinnacle = reqPin === "true" || reqPin === "1";
  const enabled = envStr("GATE_ENABLED");
  if (enabled !== undefined) cfg.enabled = !(enabled === "false" || enabled === "0");
  return cfg;
}

// ─── CACHE EM MEMÓRIA (TTL 60s) ───
let _cached: { cfg: GateConfig; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Carrega a config dinâmica (DB → env → defaults) com cache de 60s.
 * Aceita um cliente Supabase service-role.
 */
export async function loadGateConfig(sb: any, opts: { force?: boolean } = {}): Promise<GateConfig> {
  const now = Date.now();
  if (!opts.force && _cached && (now - _cached.ts) < CACHE_TTL_MS) {
    return _cached.cfg;
  }
  let cfg: GateConfig = { ...DEFAULT_GATE_CONFIG };
  try {
    const { data, error } = await sb
      .from("punter_gate_config")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    if (!error && data) {
      for (const k of Object.keys(DEFAULT_GATE_CONFIG) as (keyof GateConfig)[]) {
        if (data[k] !== null && data[k] !== undefined) {
          (cfg as any)[k] = typeof DEFAULT_GATE_CONFIG[k] === "number"
            ? Number(data[k])
            : data[k];
        }
      }
    }
  } catch (e) {
    console.warn("[gate-config] erro lendo DB, usando defaults+env:", (e as Error).message);
  }
  cfg = applyEnvOverrides(cfg);
  _cached = { cfg, ts: now };
  return cfg;
}

function normProb(p: any): number {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return n > 1.5 ? n : n * 100;
}

export function applyApprovalBlocks(input: BlockGateInput, config?: GateConfig): BlockGateResult {
  const cfg = config ?? DEFAULT_GATE_CONFIG;

  const isApproved = String(input.verdict || "").toUpperCase().startsWith("APROVADO");
  if (!isApproved) {
    return { verdict: "VETADO", block: null, tier_label: "⛔ VETADO", stake_percentage: 0, veto_reason: "IA vetou" };
  }

  // Se gate desabilitado, respeita decisão da IA sem classificar em bloco
  if (cfg.enabled === false) {
    return { verdict: "APROVADO", block: null, tier_label: "✅ APROVADO (gate off)", stake_percentage: 0, block_reason: "Gate desabilitado via config" };
  }

  const odd = Number(input.odd) || 0;
  const prob = normProb(input.estimated_probability);
  const edge = Number(input.value_percentage) || 0;
  const conf = Number(input.confidence) || 0;
  const league = String(input.league || "");
  const bookmaker = String(input.bookmaker || "").toLowerCase();
  const dataStrength = String(input.data_strength || "").toUpperCase();
  const oddDrop = Number(input.odd_drop_pct_2h) || 0;

  let strongLeagueRegex: RegExp;
  try { strongLeagueRegex = new RegExp(cfg.strong_league_regex, "i"); }
  catch { strongLeagueRegex = new RegExp(DEFAULT_GATE_CONFIG.strong_league_regex, "i"); }

  // Veto #1 — Favorito barato sem stats Nível 1
  if (odd > 0 && odd < cfg.favorite_odd_threshold && dataStrength && dataStrength !== cfg.favorite_requires_data_strength.toUpperCase()) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Favorito barato (odd ${odd.toFixed(2)}) sem stats ${cfg.favorite_requires_data_strength} — historicamente onde mais se perde.`,
      block_reason: "Veto favorito-barato",
    };
  }

  // Veto #2 — Trap line
  if (oddDrop > cfg.odd_drop_pct_threshold) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Trap line: odd caiu ${oddDrop.toFixed(1)}% em 2h — valor possivelmente já consumido.`,
      block_reason: "Veto trap-line",
    };
  }

  // Veto #3 — Liga fraca + odd baixa
  const isStrongLeague = strongLeagueRegex.test(league);
  if (!isStrongLeague && odd > 0 && odd < cfg.weak_league_odd_threshold) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Liga não-top (${league || "?"}) com odd ${odd.toFixed(2)} < ${cfg.weak_league_odd_threshold.toFixed(2)} — risco/retorno ruim.`,
      block_reason: "Veto liga-fraca + odd-baixa",
    };
  }

  // Odd fora de faixa global
  if (odd > 0 && (odd < cfg.odd_min_global || odd > cfg.odd_max_global)) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Odd ${odd.toFixed(2)} fora da faixa permitida (${cfg.odd_min_global.toFixed(2)} - ${cfg.odd_max_global.toFixed(2)}).`,
      block_reason: "Veto odd fora de faixa",
    };
  }

  // Probabilidade mínima global
  if (prob < cfg.prob_min_global) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Probabilidade estimada ${prob.toFixed(1)}% < ${cfg.prob_min_global}% mínimo global.`,
      block_reason: "Veto prob mínima global",
    };
  }

  // BLOCO C — ELITE
  const pinnacleBaseline = bookmaker.includes("pinnacle");
  if (
    prob >= cfg.c_prob_min && edge >= cfg.c_edge_min && conf >= cfg.c_conf_min &&
    (!cfg.c_requires_pinnacle || pinnacleBaseline) &&
    odd >= cfg.c_odd_min && odd <= cfg.c_odd_max
  ) {
    return {
      verdict: "APROVADO", block: "C", tier_label: "🔥 BLOCO C — ELITE",
      stake_percentage: cfg.c_stake_pct,
      block_reason: `Elite: prob ${prob.toFixed(0)}%, edge ${edge.toFixed(1)}%, conf ${conf}%${cfg.c_requires_pinnacle ? " c/ Pinnacle" : ""}`,
    };
  }

  // BLOCO B — VALOR
  if (prob >= cfg.b_prob_min && edge >= cfg.b_edge_min && conf >= cfg.b_conf_min && odd >= cfg.b_odd_min && odd <= cfg.b_odd_max) {
    return {
      verdict: "APROVADO", block: "B", tier_label: "🟡 BLOCO B — VALOR",
      stake_percentage: cfg.b_stake_pct,
      block_reason: `Valor: prob ${prob.toFixed(0)}%, edge ${edge.toFixed(1)}%, odd ${odd.toFixed(2)}`,
    };
  }

  // BLOCO A — SEGURANÇA
  if (prob >= cfg.a_prob_min && edge >= cfg.a_edge_min && conf >= cfg.a_conf_min && odd >= cfg.a_odd_min && odd <= cfg.a_odd_max) {
    return {
      verdict: "APROVADO", block: "A", tier_label: "🟢 BLOCO A — SEGURANÇA",
      stake_percentage: cfg.a_stake_pct,
      block_reason: `Segurança: prob ${prob.toFixed(0)}%, odd baixa ${odd.toFixed(2)}, edge ${edge.toFixed(1)}%`,
    };
  }

  // Anti-overfit IA — rebaixa pra A se compatível
  if (
    conf >= cfg.conf_inflation_threshold && edge < cfg.edge_inflation_threshold &&
    prob >= cfg.a_prob_min && odd >= cfg.a_odd_min && odd <= cfg.a_odd_max
  ) {
    return {
      verdict: "APROVADO", block: "A", tier_label: "🟢 BLOCO A — SEGURANÇA (rebaixado)",
      stake_percentage: cfg.a_stake_pct, demoted: true,
      block_reason: `Conf inflada (${conf}%) c/ edge ${edge.toFixed(1)}% — rebaixado pra Bloco A`,
    };
  }

  return {
    verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
    stake_percentage: 0, demoted: true,
    veto_reason: `Não atendeu nenhum bloco: prob ${prob.toFixed(1)}%, edge ${edge.toFixed(1)}%, conf ${conf}%, odd ${odd.toFixed(2)}`,
    block_reason: "Fora de todos os blocos A/B/C",
  };
}
