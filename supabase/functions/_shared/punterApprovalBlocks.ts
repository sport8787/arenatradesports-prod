// ═══════════════════════════════════════════════════════════════
// PUNTER APPROVAL BLOCKS — gate determinístico pós-IA
// ───────────────────────────────────────────────────────────────
// Aplica sistema de 3 blocos (A/B/C) + 4 vetos novos sobre a saída
// da IA. Não confia 100% no LLM — força disciplina matemática.
// Roda DEPOIS de Sherlock/Exchange edge nas edges Punter.
// ═══════════════════════════════════════════════════════════════

export type BlockTier = "A" | "B" | "C" | null;

export interface BlockGateInput {
  verdict: string;                     // já normalizado ("APROVADO" | "VETADO")
  market: string | null | undefined;
  odd: number | null | undefined;
  estimated_probability: number | null | undefined; // 0-100
  value_percentage: number | null | undefined;      // edge em %
  confidence: number | null | undefined;            // 0-100
  league?: string | null;
  bookmaker?: string | null;
  data_strength?: string | null;       // "ALTA" | "MEDIA" | "BAIXA"
  odd_drop_pct_2h?: number | null;     // % de queda da odd nas últimas 2h (>0 = caiu)
}

export interface BlockGateResult {
  verdict: "APROVADO" | "VETADO";
  block: BlockTier;                    // A/B/C ou null se VETADO
  tier_label: string;                  // ex: "🟢 BLOCO A — SEGURANÇA"
  stake_percentage: number;            // override do stake
  veto_reason?: string;
  demoted?: boolean;                   // true se IA aprovou mas gate vetou
  block_reason?: string;               // descrição amigável
}

// Whitelist de ligas "fortes" (relaxa veto #3)
const STRONG_LEAGUE_REGEX = /(premier league|la liga|primera divis|serie a|bundesliga|ligue 1|champions|europa|conference|libertadores|sudamericana|brasileir|copa do brasil|eredivisie|primeira liga|jupiler|championship|copa america|world cup|euro)/i;

function normProb(p: any): number {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return n > 1.5 ? n : n * 100; // aceita 0-1 ou 0-100
}

export function applyApprovalBlocks(input: BlockGateInput): BlockGateResult {
  const isApproved = String(input.verdict || "").toUpperCase().startsWith("APROVADO");
  if (!isApproved) {
    return { verdict: "VETADO", block: null, tier_label: "⛔ VETADO", stake_percentage: 0, veto_reason: "IA vetou" };
  }

  const odd = Number(input.odd) || 0;
  const prob = normProb(input.estimated_probability);
  const edge = Number(input.value_percentage) || 0;
  const conf = Number(input.confidence) || 0;
  const league = String(input.league || "");
  const market = String(input.market || "");
  const bookmaker = String(input.bookmaker || "").toLowerCase();
  const dataStrength = String(input.data_strength || "").toUpperCase();
  const oddDrop = Number(input.odd_drop_pct_2h) || 0;

  // ─────── VETOS DETERMINÍSTICOS (rodam antes da classificação) ───────

  // Veto #1 — Favorito barato sem stats Nível 1 (dado fraco em odd <1.50)
  if (odd > 0 && odd < 1.50 && dataStrength && dataStrength !== "ALTA") {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Favorito barato (odd ${odd.toFixed(2)}) sem stats ALTA — historicamente onde mais se perde.`,
      block_reason: "Veto favorito-barato",
    };
  }

  // Veto #2 — Trap line: odd caiu >8% nas últimas 2h (sharp money pode ter comido o valor)
  if (oddDrop > 8) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Trap line: odd caiu ${oddDrop.toFixed(1)}% em 2h — valor possivelmente já consumido.`,
      block_reason: "Veto trap-line",
    };
  }

  // Veto #3 — Liga fraca + odd baixa (combinação que destrói win rate)
  const isStrongLeague = STRONG_LEAGUE_REGEX.test(league);
  if (!isStrongLeague && odd > 0 && odd < 1.60) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Liga não-top (${league || "?"}) com odd ${odd.toFixed(2)} < 1.60 — risco/retorno ruim.`,
      block_reason: "Veto liga-fraca + odd-baixa",
    };
  }

  // Veto fundamental — odd fora da faixa global permitida (1.30 - 4.50)
  if (odd > 0 && (odd < 1.30 || odd > 4.50)) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Odd ${odd.toFixed(2)} fora da faixa permitida (1.30 - 4.50).`,
      block_reason: "Veto odd fora de faixa",
    };
  }

  // Probabilidade mínima absoluta global
  if (prob < 45) {
    return {
      verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
      stake_percentage: 0, demoted: true,
      veto_reason: `Probabilidade estimada ${prob.toFixed(1)}% < 45% mínimo global.`,
      block_reason: "Veto prob mínima global",
    };
  }

  // ─────── CLASSIFICAÇÃO EM BLOCOS ───────

  // 🔥 BLOCO C — ELITE (raros, alto retorno)
  const pinnacleBaseline = bookmaker.includes("pinnacle");
  if (prob >= 55 && edge >= 7 && conf >= 80 && pinnacleBaseline && odd >= 1.50 && odd <= 4.50) {
    return {
      verdict: "APROVADO", block: "C", tier_label: "🔥 BLOCO C — ELITE",
      stake_percentage: 4,
      block_reason: `Elite: prob ${prob.toFixed(0)}%, edge ${edge.toFixed(1)}%, conf ${conf}% c/ Pinnacle`,
    };
  }

  // 🟡 BLOCO B — VALOR (foco em ROI)
  if (prob >= 45 && edge >= 5 && conf >= 70 && odd >= 1.85 && odd <= 3.20) {
    // Anti-overfit IA: se conf ≥85% mas edge <5% nesse range, rebaixa pra Bloco A
    // (já passamos o filtro edge>=5, então só aplica em B->A se edge<5 — então pula)
    return {
      verdict: "APROVADO", block: "B", tier_label: "🟡 BLOCO B — VALOR",
      stake_percentage: 3,
      block_reason: `Valor: prob ${prob.toFixed(0)}%, edge ${edge.toFixed(1)}%, odd ${odd.toFixed(2)}`,
    };
  }

  // 🟢 BLOCO A — SEGURANÇA (foco em win rate, odd baixa)
  if (prob >= 58 && edge >= 3 && conf >= 72 && odd >= 1.30 && odd <= 1.85) {
    return {
      verdict: "APROVADO", block: "A", tier_label: "🟢 BLOCO A — SEGURANÇA",
      stake_percentage: 2,
      block_reason: `Segurança: prob ${prob.toFixed(0)}%, odd baixa ${odd.toFixed(2)}, edge ${edge.toFixed(1)}%`,
    };
  }

  // Anti-overfit IA — conf inflada (≥85) com edge baixo (<5): tenta rebaixar pra A se prob/odd permitirem
  if (conf >= 85 && edge < 5 && prob >= 58 && odd >= 1.30 && odd <= 1.85) {
    return {
      verdict: "APROVADO", block: "A", tier_label: "🟢 BLOCO A — SEGURANÇA (rebaixado)",
      stake_percentage: 2, demoted: true,
      block_reason: `Conf inflada (${conf}%) c/ edge ${edge.toFixed(1)}% — rebaixado pra Bloco A`,
    };
  }

  // Não se encaixou em nenhum bloco → veta
  return {
    verdict: "VETADO", block: null, tier_label: "⛔ VETADO",
    stake_percentage: 0, demoted: true,
    veto_reason: `Não atendeu nenhum bloco: prob ${prob.toFixed(1)}%, edge ${edge.toFixed(1)}%, conf ${conf}%, odd ${odd.toFixed(2)}`,
    block_reason: "Fora de todos os blocos A/B/C",
  };
}
