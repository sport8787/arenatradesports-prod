// Testes unitários para o Plano Over 0.5 HT (regras v2)
// Cenário 1: um time claramente dominando.
// Cenário 2: jogo aberto e movimentado.
// xG é OPCIONAL nos dois cenários — só reprova se estiver presente e abaixo do limiar.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

interface TeamStats {
  possession: number;       // %
  dangerousAttacks: number; // total acumulado
  shotsOnTarget: number;
  xG?: number;              // opcional
}

interface MatchInput {
  minute: number;
  scoreHome: number;
  scoreAway: number;
  home?: TeamStats;
  away?: TeamStats;
}

type Verdict = { approved: boolean; cenario: 1 | 2 | null; veto?: string };

/**
 * Implementação determinística do Plano Over 0.5 HT (v2)
 * Espelha as regras cadastradas em mycroft_planos.OVER05HT.
 */
export function evaluateOver05HT(m: MatchInput): Verdict {
  // Vetos globais
  if (m.scoreHome + m.scoreAway > 0) {
    return { approved: false, cenario: null, veto: 'Já existe gol no placar' };
  }
  if (m.minute < 10 || m.minute > 25) {
    return { approved: false, cenario: null, veto: 'Minuto fora da janela 10-25' };
  }

  const checkTeamC1 = (t?: TeamStats): boolean => {
    if (!t) return false;
    const xgOk = t.xG === undefined || t.xG >= 0.75; // opcional
    return t.possession >= 60 && t.dangerousAttacks >= 5 && t.shotsOnTarget >= 3 && xgOk;
  };

  // Cenário 1 — qualquer time dominando
  if (checkTeamC1(m.home) || checkTeamC1(m.away)) {
    return { approved: true, cenario: 1 };
  }

  // Cenário 2 — jogo aberto e movimentado
  if (m.home && m.away) {
    const totalAttacks = m.home.dangerousAttacks + m.away.dangerousAttacks;
    const totalShots = m.home.shotsOnTarget + m.away.shotsOnTarget;
    const balanced = m.home.possession >= 35 && m.away.possession >= 35;
    const totalXg =
      m.home.xG !== undefined && m.away.xG !== undefined
        ? m.home.xG + m.away.xG
        : undefined;
    const xgOk = totalXg === undefined || totalXg >= 1.0;

    if (totalAttacks >= 8 && totalShots >= 5 && balanced && xgOk) {
      return { approved: true, cenario: 2 };
    }

    if (!balanced) {
      return { approved: false, cenario: null, veto: 'Algum time com posse < 35%' };
    }
  }

  return { approved: false, cenario: null, veto: 'Nenhum cenário 100% atendido' };
}

// ─────────────────────────────────────────────────────────────
// CENÁRIO 1 — Um time dominando claramente
// ─────────────────────────────────────────────────────────────

Deno.test("C1: aprova com home dominando (todos critérios + xG)", () => {
  const r = evaluateOver05HT({
    minute: 18, scoreHome: 0, scoreAway: 0,
    home: { possession: 65, dangerousAttacks: 7, shotsOnTarget: 4, xG: 0.9 },
    away: { possession: 35, dangerousAttacks: 2, shotsOnTarget: 1, xG: 0.2 },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("C1: aprova com away dominando", () => {
  const r = evaluateOver05HT({
    minute: 22, scoreHome: 0, scoreAway: 0,
    home: { possession: 30, dangerousAttacks: 2, shotsOnTarget: 1 },
    away: { possession: 70, dangerousAttacks: 8, shotsOnTarget: 3, xG: 0.85 },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("C1: aprova SEM xG (xG opcional/ausente)", () => {
  const r = evaluateOver05HT({
    minute: 15, scoreHome: 0, scoreAway: 0,
    home: { possession: 62, dangerousAttacks: 6, shotsOnTarget: 3 },
    away: { possession: 38, dangerousAttacks: 3, shotsOnTarget: 1 },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("C1: rejeita posse 59% (precisa >= 60)", () => {
  const r = evaluateOver05HT({
    minute: 18, scoreHome: 0, scoreAway: 0,
    home: { possession: 59, dangerousAttacks: 7, shotsOnTarget: 4, xG: 1.0 },
    away: { possession: 41, dangerousAttacks: 2, shotsOnTarget: 1 },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita ataques perigosos = 4 (precisa >= 5)", () => {
  const r = evaluateOver05HT({
    minute: 18, scoreHome: 0, scoreAway: 0,
    home: { possession: 65, dangerousAttacks: 4, shotsOnTarget: 4, xG: 1.0 },
    away: { possession: 35, dangerousAttacks: 2, shotsOnTarget: 1 },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita chutes a gol = 2 (precisa >= 3)", () => {
  const r = evaluateOver05HT({
    minute: 18, scoreHome: 0, scoreAway: 0,
    home: { possession: 65, dangerousAttacks: 7, shotsOnTarget: 2, xG: 1.0 },
    away: { possession: 35, dangerousAttacks: 2, shotsOnTarget: 1 },
  });
  assertEquals(r.approved, false);
});

Deno.test("C1: rejeita xG presente abaixo de 0.75", () => {
  const r = evaluateOver05HT({
    minute: 18, scoreHome: 0, scoreAway: 0,
    home: { possession: 65, dangerousAttacks: 7, shotsOnTarget: 4, xG: 0.5 },
    away: { possession: 35, dangerousAttacks: 2, shotsOnTarget: 1 },
  });
  assertEquals(r.approved, false);
});

// ─────────────────────────────────────────────────────────────
// CENÁRIO 2 — Jogo aberto e movimentado
// ─────────────────────────────────────────────────────────────

Deno.test("C2: aprova com totais ok e posse equilibrada", () => {
  const r = evaluateOver05HT({
    minute: 22, scoreHome: 0, scoreAway: 0,
    home: { possession: 52, dangerousAttacks: 5, shotsOnTarget: 3, xG: 0.6 },
    away: { possession: 48, dangerousAttacks: 4, shotsOnTarget: 2, xG: 0.5 },
  });
  // total attacks=9, shots=5, xG=1.1, posse 52/48
  assertEquals(r, { approved: true, cenario: 2 });
});

Deno.test("C2: aprova SEM xG (opcional)", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 55, dangerousAttacks: 5, shotsOnTarget: 3 },
    away: { possession: 45, dangerousAttacks: 4, shotsOnTarget: 3 },
  });
  assertEquals(r, { approved: true, cenario: 2 });
});

Deno.test("C2: rejeita ataques totais = 7 (precisa >= 8)", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 50, dangerousAttacks: 4, shotsOnTarget: 3 },
    away: { possession: 50, dangerousAttacks: 3, shotsOnTarget: 3 },
  });
  assertEquals(r.approved, false);
});

Deno.test("C2: rejeita chutes totais = 4 (precisa >= 5)", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 50, dangerousAttacks: 5, shotsOnTarget: 2 },
    away: { possession: 50, dangerousAttacks: 5, shotsOnTarget: 2 },
  });
  assertEquals(r.approved, false);
});

Deno.test("C2: rejeita posse desequilibrada (away 30%)", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 70, dangerousAttacks: 5, shotsOnTarget: 3 },
    away: { possession: 30, dangerousAttacks: 4, shotsOnTarget: 2 },
  });
  // bate C2 nos demais critérios mas posse < 35
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Algum time com posse < 35%');
});

Deno.test("C2: rejeita xG total presente < 1.0", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 52, dangerousAttacks: 5, shotsOnTarget: 3, xG: 0.4 },
    away: { possession: 48, dangerousAttacks: 4, shotsOnTarget: 2, xG: 0.3 },
  });
  assertEquals(r.approved, false);
});

// ─────────────────────────────────────────────────────────────
// Vetos globais (placar e janela)
// ─────────────────────────────────────────────────────────────

Deno.test("VETO: minuto 9 — fora da janela inferior", () => {
  const r = evaluateOver05HT({
    minute: 9, scoreHome: 0, scoreAway: 0,
    home: { possession: 70, dangerousAttacks: 8, shotsOnTarget: 4, xG: 1.0 },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Minuto fora da janela 10-25');
});

Deno.test("VETO: minuto 26 — fora da janela superior", () => {
  const r = evaluateOver05HT({
    minute: 26, scoreHome: 0, scoreAway: 0,
    home: { possession: 70, dangerousAttacks: 8, shotsOnTarget: 4, xG: 1.0 },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Minuto fora da janela 10-25');
});

Deno.test("VETO: já tem gol no placar (mercado morto)", () => {
  const r = evaluateOver05HT({
    minute: 15, scoreHome: 1, scoreAway: 0,
    home: { possession: 70, dangerousAttacks: 8, shotsOnTarget: 4, xG: 1.0 },
  });
  assertEquals(r.approved, false);
  assertEquals(r.veto, 'Já existe gol no placar');
});

// ─────────────────────────────────────────────────────────────
// Bordas da janela
// ─────────────────────────────────────────────────────────────

Deno.test("BORDA: minuto 10 (limite inferior) aprova C1 se critérios ok", () => {
  const r = evaluateOver05HT({
    minute: 10, scoreHome: 0, scoreAway: 0,
    home: { possession: 65, dangerousAttacks: 5, shotsOnTarget: 3, xG: 0.8 },
    away: { possession: 35, dangerousAttacks: 1, shotsOnTarget: 0 },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});

Deno.test("BORDA: minuto 25 (limite superior) aprova C2 se critérios ok", () => {
  const r = evaluateOver05HT({
    minute: 25, scoreHome: 0, scoreAway: 0,
    home: { possession: 50, dangerousAttacks: 5, shotsOnTarget: 3 },
    away: { possession: 50, dangerousAttacks: 4, shotsOnTarget: 2 },
  });
  assertEquals(r, { approved: true, cenario: 2 });
});

// ─────────────────────────────────────────────────────────────
// Prioridade: C1 antes de C2 quando ambos batem
// ─────────────────────────────────────────────────────────────

Deno.test("PRIORIDADE: aprova como C1 quando ambos cenários atendem", () => {
  const r = evaluateOver05HT({
    minute: 20, scoreHome: 0, scoreAway: 0,
    home: { possession: 62, dangerousAttacks: 6, shotsOnTarget: 3, xG: 0.9 },
    away: { possession: 38, dangerousAttacks: 4, shotsOnTarget: 3, xG: 0.5 },
  });
  assertEquals(r, { approved: true, cenario: 1 });
});
