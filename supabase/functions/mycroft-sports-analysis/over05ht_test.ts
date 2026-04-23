// Testes unitários para o Plano Over 0.5 HT
// Valida regras determinísticas (sem chamar IA): cenário 1, cenário 2 e vetos.
//
// O motor de análise no edge function delega o casamento dos critérios à IA,
// mas as regras são determinísticas. Replicamos aqui a lógica oficial cadastrada
// na tabela `mycroft_planos` (código OVER05HT) para garantir que qualquer
// alteração futura nas regras quebre estes testes.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

interface MatchInput {
  minute: number;
  scoreHome: number;
  scoreAway: number;
  // Estatísticas favorito (cenário 1)
  fav?: {
    possession: number;       // %
    dangerousAttacks: number; // total acumulado
    xG: number;
    shotsOnTarget: number;
    pressure: 'BAIXA' | 'MEDIA' | 'ALTA';
  };
  // Estatísticas somadas casa+fora (cenário 2)
  total?: {
    dangerousAttacks: number;
    xG: number;
    shotsOnTarget: number;
    pressure: 'BAIXA' | 'MEDIA' | 'ALTA';
  };
}

type Verdict = { approved: boolean; cenario: 1 | 2 | null; veto?: string };

/**
 * Implementação determinística do Plano Over 0.5 HT
 * (espelho exato das regras cadastradas em mycroft_planos.OVER05HT)
 */
export function evaluateOver05HT(m: MatchInput): Verdict {
  // Veto: já tem gol
  if (m.scoreHome + m.scoreAway > 0) {
    return { approved: false, cenario: null, veto: 'Já existe gol no placar' };
  }
  // Veto: fora da janela 10-25
  if (m.minute < 10 || m.minute > 25) {
    return { approved: false, cenario: null, veto: 'Minuto fora da janela 10-25' };
  }

  // Cenário 1 — favorito dominando
  if (m.fav) {
    const f = m.fav;
    const apm = f.dangerousAttacks / m.minute; // ataques perigosos por minuto
    const c1 =
      f.possession > 60 &&
      apm >= 1 &&
      f.xG >= 0.75 &&
      f.shotsOnTarget >= 3 &&
      f.pressure === 'ALTA';
    if (c1) return { approved: true, cenario: 1 };
  }

  // Cenário 2 — jogo equilibrado e movimentado
  if (m.total) {
    const t = m.total;
    const apm = t.dangerousAttacks / m.minute;
    const c2 =
      apm >= 1.5 &&
      t.xG >= 1.0 &&
      t.shotsOnTarget >= 5 &&
      t.pressure === 'ALTA';
    if (c2) return { approved: true, cenario: 2 };
  }

  return { approved: false, cenario: null, veto: 'Nenhum cenário 100% atendido' };
}

// ─────────────────────────────────────────────────────────────
// CENÁRIO 1 — Favorito dominando
// ─────────────────────────────────────────────────────────────

Deno.test("C1: aprova com todos os critérios atendidos no minuto 18", () => {
  const r = evaluateOver05HT({
    minute: 18,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 65, dangerousAttacks: 22, xG: 0.9, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("C1: rejeita com posse igual a 60% (precisa ser > 60)", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 60, dangerousAttacks: 25, xG: 0.9, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita com xG abaixo de 0.75", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 25, xG: 0.74, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita com chutes a gol = 2 (precisa >= 3)", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 25, xG: 1.0, shotsOnTarget: 2, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita com ataques perigosos/min < 1", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 15, xG: 1.0, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  // 15/20 = 0.75 < 1
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita com pressão MEDIA", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 25, xG: 1.0, shotsOnTarget: 4, pressure: 'MEDIA' },
  });
  assertEquals(r.approved, false);
});

// ─────────────────────────────────────────────────────────────
// CENÁRIO 2 — Jogo equilibrado e movimentado (somatório)
// ─────────────────────────────────────────────────────────────

Deno.test("C2: aprova com soma de critérios atendida no minuto 22", () => {
  const r = evaluateOver05HT({
    minute: 22,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 36, xG: 1.2, shotsOnTarget: 6, pressure: 'ALTA' },
  });
  // 36/22 ≈ 1.63 >= 1.5
  assertEquals(r, { approved: true, cenario: 2 });
});

Deno.test("C2: rejeita com soma xG < 1.0", () => {
  const r = evaluateOver05HT({
    minute: 22,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 40, xG: 0.95, shotsOnTarget: 6, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
});

Deno.test("C2: rejeita com soma chutes a gol = 4", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 35, xG: 1.5, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
});

Deno.test("C2: rejeita com soma ataques perigosos/min abaixo de 1.5", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 25, xG: 1.5, shotsOnTarget: 6, pressure: 'ALTA' },
  });
  // 25/20 = 1.25 < 1.5
  assertEquals(r.approved, false);
});

Deno.test("C2: rejeita com pressão somada BAIXA", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 40, xG: 1.5, shotsOnTarget: 6, pressure: 'BAIXA' },
  });
  assertEquals(r.approved, false);
});

// ─────────────────────────────────────────────────────────────
// Vetos globais (placar e janela)
// ─────────────────────────────────────────────────────────────

Deno.test("VETO: minuto 9 — fora da janela inferior", () => {
  const r = evaluateOver05HT({
    minute: 9,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 12, xG: 0.9, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Minuto fora da janela 10-25');
});

Deno.test("VETO: minuto 26 — fora da janela superior", () => {
  const r = evaluateOver05HT({
    minute: 26,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 30, xG: 1.2, shotsOnTarget: 5, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Minuto fora da janela 10-25');
});

Deno.test("VETO: já tem gol no placar (mercado morto)", () => {
  const r = evaluateOver05HT({
    minute: 15,
    scoreHome: 1,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 20, xG: 0.9, shotsOnTarget: 4, pressure: 'ALTA' },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Já existe gol no placar');
});

// ─────────────────────────────────────────────────────────────
// Bordas da janela
// ─────────────────────────────────────────────────────────────

Deno.test("BORDA: minuto 10 (limite inferior) aprova C1 se critérios ok", () => {
  const r = evaluateOver05HT({
    minute: 10,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 65, dangerousAttacks: 12, xG: 0.8, shotsOnTarget: 3, pressure: 'ALTA' },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("BORDA: minuto 25 (limite superior) aprova C2 se critérios ok", () => {
  const r = evaluateOver05HT({
    minute: 25,
    scoreHome: 0,
    scoreAway: 0,
    total: { dangerousAttacks: 40, xG: 1.0, shotsOnTarget: 5, pressure: 'ALTA' },
  });
  assertEquals(r, { approved: true, cenario: 2 });
});

// ─────────────────────────────────────────────────────────────
// Prioridade: C1 antes de C2 quando ambos batem
// ─────────────────────────────────────────────────────────────

Deno.test("PRIORIDADE: aprova como C1 quando ambos cenários atendem", () => {
  const r = evaluateOver05HT({
    minute: 20,
    scoreHome: 0,
    scoreAway: 0,
    fav: { possession: 70, dangerousAttacks: 25, xG: 1.0, shotsOnTarget: 4, pressure: 'ALTA' },
    total: { dangerousAttacks: 40, xG: 1.5, shotsOnTarget: 7, pressure: 'ALTA' },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});
