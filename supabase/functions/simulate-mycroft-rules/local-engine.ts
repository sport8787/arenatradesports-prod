// Local copy of the engine logic (sem cache, sem fetch DB) — usado pelo simulador
// para suportar override de regras/config sem invalidar o cache de produção.
import type { MycroftRule, MycroftConfig, EngineResult } from "../_shared/mycroft-rules-engine.ts";

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

export function runEngineLocal(opts: {
  rules: MycroftRule[];
  config: MycroftConfig;
  mercado: string;
  odd?: number;
  minute?: number;
  stats: Record<string, any>;
}): EngineResult {
  const { rules, config, mercado, odd, minute, stats } = opts;
  let score = 0;
  let vetado = false;
  const razoes: string[] = [];
  const bonus: string[] = [];
  const logs: EngineResult["logs"] = [];

  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (!ruleApplies(rule, mercado, minute)) continue;
    const observed = Number(stats[rule.field] ?? NaN);
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
      razoes.push(`🚫 ${rule.name}`);
      logs.push({ rule: rule.name, matched: true, field: rule.field, observed, op: rule.operator, value: rule.value, veto: true });
      break;
    } else {
      const delta = Number(rule.points ?? 0);
      score += delta;
      bonus.push(`✅ ${rule.name} (+${delta})`);
      logs.push({ rule: rule.name, matched: true, field: rule.field, observed, op: rule.operator, value: rule.value, delta });
    }
  }

  let status: EngineResult["status"];
  if (vetado) status = "VETADO";
  else if (odd != null && (odd < config.odd_minima || odd > config.odd_maxima)) {
    status = "AGUARDAR";
    razoes.push(`Odd ${odd} fora da faixa`);
  } else if (score >= config.score_minimo_aprovar) status = "APROVADO";
  else if (score >= config.score_minimo_cuidado) status = "CUIDADO";
  else status = "AGUARDAR";

  const range = Math.max(0, config.score_minimo_aprovar - config.score_minimo_cuidado) || 1;
  const ratio = Math.min(1, Math.max(0, (score - config.score_minimo_cuidado) / range));
  const stake = +(config.stake_min_percent + ratio * (config.stake_max_percent - config.stake_min_percent)).toFixed(2);

  return {
    status,
    score,
    stake: status === "APROVADO" ? stake : 0,
    explicacao: { score, vetado, razoes, bonus, modo: "trader" as any, mercado },
    logs,
  };
}
