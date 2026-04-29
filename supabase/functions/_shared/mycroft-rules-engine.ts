// ═══════════════════════════════════════════════════════════════
// MYCROFT RULES ENGINE — motor de regras dinâmico (shadow mode)
// ───────────────────────────────────────────────────────────────
// Lê regras + config do banco (mycroft_rules / mycroft_config) e
// avalia stats de um jogo. Determinístico, sem IA. Usado em
// paralelo aos motores atuais para comparação (analises_comparativas).
// ═══════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Modo = "trader" | "punter";

export interface MycroftRule {
  id: string;
  modo: Modo;
  name: string;
  category: "pontuacao" | "veto";
  field: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: number;
  points: number | null;
  priority: number;
  mercado: string | null;
  time_start: number | null;
  time_end: number | null;
  active: boolean;
}

export interface MycroftConfig {
  score_minimo_aprovar: number;
  score_minimo_cuidado: number;
  stake_min_percent: number;
  stake_max_percent: number;
  odd_minima: number;
  odd_maxima: number;
  tempo_minimo_analise: number;
}

export interface EngineInput {
  modo: Modo;
  mercado: string;
  odd?: number;
  minute?: number;
  stats: Record<string, number | undefined | null>;
}

export interface EngineResult {
  status: "APROVADO" | "CUIDADO" | "AGUARDAR" | "VETADO";
  score: number;
  stake: number;
  explicacao: { score: number; vetado: boolean; razoes: string[]; bonus: string[]; modo: Modo; mercado: string };
  logs: Array<{ rule: string; matched: boolean; field: string; observed: any; op: string; value: number; delta?: number; veto?: boolean }>;
}

const cache = new Map<string, { rules: MycroftRule[]; config: MycroftConfig; ts: number }>();
const TTL_MS = 60_000; // 1min cache

export async function loadEngineState(sb: SupabaseClient, modo: Modo) {
  const cached = cache.get(modo);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached;

  const [rulesRes, cfgRes] = await Promise.all([
    sb.from("mycroft_rules").select("*").eq("modo", modo).eq("active", true).order("priority", { ascending: false }),
    sb.from("mycroft_config").select("key,value").eq("modo", modo),
  ]);
  const rules = (rulesRes.data ?? []) as MycroftRule[];
  const cfgRaw = (cfgRes.data ?? []) as Array<{ key: string; value: string }>;
  const config: MycroftConfig = {
    score_minimo_aprovar: 70,
    score_minimo_cuidado: 50,
    stake_min_percent: 2,
    stake_max_percent: 5,
    odd_minima: 1.5,
    odd_maxima: 3.0,
    tempo_minimo_analise: 10,
    ...Object.fromEntries(cfgRaw.map((r) => [r.key, Number(r.value)])),
  } as MycroftConfig;

  const entry = { rules, config, ts: Date.now() };
  cache.set(modo, entry);
  return entry;
}

function compare(observed: number, op: string, value: number): boolean {
  switch (op) {
    case ">": return observed > value;
    case ">=": return observed >= value;
    case "<": return observed < value;
    case "<=": return observed <= value;
    case "==": return observed === value;
    case "!=": return observed !== value;
    default: return false;
  }
}

function ruleApplies(rule: MycroftRule, mercado: string, minute: number | undefined): boolean {
  if (rule.mercado && rule.mercado.trim() && !mercado.toLowerCase().includes(rule.mercado.toLowerCase())) return false;
  if (rule.time_start != null && minute != null && minute < rule.time_start) return false;
  if (rule.time_end != null && minute != null && minute > rule.time_end) return false;
  return true;
}

export async function avaliarJogo(sb: SupabaseClient, input: EngineInput): Promise<EngineResult> {
  const { rules, config } = await loadEngineState(sb, input.modo);
  let score = 0;
  let vetado = false;
  const razoes: string[] = [];
  const bonus: string[] = [];
  const logs: EngineResult["logs"] = [];

  for (const rule of rules) {
    if (!ruleApplies(rule, input.mercado, input.minute)) continue;
    const observed = Number(input.stats[rule.field] ?? NaN);
    if (Number.isNaN(observed)) {
      logs.push({ rule: rule.name, matched: false, field: rule.field, observed: null, op: rule.operator, value: rule.value });
      continue;
    }
    const matched = compare(observed, rule.operator, rule.value);
    if (!matched) {
      logs.push({ rule: rule.name, matched: false, field: rule.field, observed, op: rule.operator, value: rule.value });
      continue;
    }
    if (rule.category === "veto") {
      vetado = true;
      razoes.push(`🚫 ${rule.name} (${rule.field} ${rule.operator} ${rule.value}, observado=${observed})`);
      logs.push({ rule: rule.name, matched: true, field: rule.field, observed, op: rule.operator, value: rule.value, veto: true });
      break; // veto encerra
    } else {
      const delta = Number(rule.points ?? 0);
      score += delta;
      bonus.push(`✅ ${rule.name} (+${delta})`);
      logs.push({ rule: rule.name, matched: true, field: rule.field, observed, op: rule.operator, value: rule.value, delta });
    }
  }

  let status: EngineResult["status"];
  if (vetado) status = "VETADO";
  else if (input.odd != null && (input.odd < config.odd_minima || input.odd > config.odd_maxima)) {
    status = "AGUARDAR";
    razoes.push(`Odd ${input.odd} fora da faixa ${config.odd_minima}-${config.odd_maxima}`);
  } else if (score >= config.score_minimo_aprovar) status = "APROVADO";
  else if (score >= config.score_minimo_cuidado) status = "CUIDADO";
  else status = "AGUARDAR";

  // Stake proporcional ao score (linear entre min e max)
  const range = Math.max(0, config.score_minimo_aprovar - config.score_minimo_cuidado) || 1;
  const ratio = Math.min(1, Math.max(0, (score - config.score_minimo_cuidado) / range));
  const stake = +(config.stake_min_percent + ratio * (config.stake_max_percent - config.stake_min_percent)).toFixed(2);

  return {
    status,
    score,
    stake: status === "APROVADO" ? stake : 0,
    explicacao: { score, vetado, razoes, bonus, modo: input.modo, mercado: input.mercado },
    logs,
  };
}

// ─── Helper de shadow mode (não falha o motor atual) ─────────────
export async function shadowCompare(opts: {
  sb: SupabaseClient;
  modo: Modo;
  source_function: string;
  match_id?: string;
  fixture_id?: string;
  mercado: string;
  league?: string;
  home_team?: string;
  away_team?: string;
  odd?: number;
  minute?: number;
  stats: Record<string, any>;
  verdicto_atual?: string;
  score_atual?: number;
  stake_atual?: number;
  data_jogo?: string;
}) {
  try {
    const result = await avaliarJogo(opts.sb, {
      modo: opts.modo,
      mercado: opts.mercado,
      odd: opts.odd,
      minute: opts.minute,
      stats: opts.stats,
    });
    await opts.sb.from("analises_comparativas").insert({
      modo: opts.modo,
      source_function: opts.source_function,
      match_id: opts.match_id ?? null,
      fixture_id: opts.fixture_id ?? null,
      mercado: opts.mercado,
      league: opts.league ?? null,
      home_team: opts.home_team ?? null,
      away_team: opts.away_team ?? null,
      verdicto_atual: opts.verdicto_atual ?? null,
      score_atual: opts.score_atual ?? null,
      stake_atual: opts.stake_atual ?? null,
      odd_atual: opts.odd ?? null,
      verdicto_novo: result.status,
      score_novo: result.score,
      stake_novo: result.stake,
      odd_novo: opts.odd ?? null,
      explicacao_novo: result.explicacao,
      logs_novo: result.logs,
      stats_snapshot: opts.stats,
      data_jogo: opts.data_jogo ?? null,
    });
    return result;
  } catch (err) {
    console.warn("[shadowCompare] erro:", (err as Error).message);
    return null;
  }
}
