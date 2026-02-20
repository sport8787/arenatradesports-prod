/**
 * COGNITIVE LEAKS SERVICE — Arena Poker
 * ======================================
 * 
 * Detecta padrões recorrentes de decisão subótima causados por
 * viés psicológico (não por falta de conhecimento técnico).
 * 
 * Taxonomia v1:
 *   A — Impulsividade  (A1: Apego à Mão, A2: Overplay por Euforia)
 *   B — Medo           (B1: Medo de Matar a Ação, B2: Passividade por Incerteza)
 *   C — Ego            (C1: Hero Syndrome, C2: Refusal to Fold)
 */

// ─── Taxonomy ────────────────────────────────────────────────

export interface CognitiveLeakDef {
  code: string;
  classe: 'A' | 'B' | 'C';
  classeLabel: string;
  classeColor: string;  // semantic token ref
  title: string;
  description: string;
  symptom: string;
  innerVoice: string;
  rootCause: string;
}

export const COGNITIVE_LEAKS: Record<string, CognitiveLeakDef> = {
  A1: {
    code: 'A1',
    classe: 'A',
    classeLabel: 'Impulsividade',
    classeColor: 'destructive',
    title: 'Apego à Mão',
    description: 'Superestimação da força relativa da própria mão',
    symptom: 'Calls repetidos com equidade negativa',
    innerVoice: '"Ainda pode virar…"',
    rootCause: 'Aversão à perda + efeito endowment',
  },
  A2: {
    code: 'A2',
    classe: 'A',
    classeLabel: 'Impulsividade',
    classeColor: 'destructive',
    title: 'Overplay por Euforia',
    description: 'Agressão excessiva após acertar algo "bonito"',
    symptom: 'Raises automáticos sem considerar range adversário',
    innerVoice: '"Agora é minha vez"',
    rootCause: 'Dopamina + excesso de confiança',
  },
  B1: {
    code: 'B1',
    classe: 'B',
    classeLabel: 'Medo',
    classeColor: 'arena-gold',
    title: 'Medo de Matar a Ação',
    description: 'Sizings abaixo do ótimo para "manter vilão"',
    symptom: 'Bets de 25–40% quando 60–80% é correto',
    innerVoice: '"Se eu apostar alto, ele foge"',
    rootCause: 'Medo de rejeição + viés social',
  },
  B2: {
    code: 'B2',
    classe: 'B',
    classeLabel: 'Medo',
    classeColor: 'arena-gold',
    title: 'Passividade por Incerteza',
    description: 'Check/call automático em spots agressivos',
    symptom: 'Jogador "espera para ver"',
    innerVoice: '"Não tenho certeza suficiente"',
    rootCause: 'Baixa tolerância à ambiguidade',
  },
  C1: {
    code: 'C1',
    classe: 'C',
    classeLabel: 'Ego',
    classeColor: 'arena-cyan',
    title: 'Hero Syndrome',
    description: 'Desejo de ganhar potes grandes com linhas desnecessárias',
    symptom: 'Linhas desnecessariamente complexas',
    innerVoice: '"Essa mão vai ser épica"',
    rootCause: 'Identidade ligada à vitória, não à decisão correta',
  },
  C2: {
    code: 'C2',
    classe: 'C',
    classeLabel: 'Ego',
    classeColor: 'arena-cyan',
    title: 'Refusal to Fold',
    description: 'Incapacidade de abandonar linha já iniciada',
    symptom: '"Já investi demais"',
    innerVoice: '"Agora não dá mais pra largar"',
    rootCause: 'Sunk cost fallacy',
  },
};

// ─── Detection History ───────────────────────────────────────

export interface DecisionRecord {
  street: string;
  playerAction: string;
  correctAction: string;
  wasCorrect: boolean;
  nota: number;
  evDiferenca: string;
  potSize: number;
  heroStack: number;
  scenarioText: string;
}

export interface DetectedLeak {
  leak: CognitiveLeakDef;
  confidence: number;        // 0–100
  occurrences: number;
  recentHands: number[];     // hand indices
  evLost: string;            // estimated BB lost
  reprogramming: string;     // cognitive reframe suggestion
}

// Module-level history across the training session
let decisionHistory: DecisionRecord[] = [];
let handIndex = 0;

export function resetLeakTracker(): void {
  decisionHistory = [];
  handIndex = 0;
}

export function advanceHandIndex(): void {
  handIndex++;
}

export function recordDecision(record: DecisionRecord): void {
  decisionHistory.push({ ...record });
}

// ─── Pattern Detection ───────────────────────────────────────

function detectLeaks(): DetectedLeak[] {
  const detected: DetectedLeak[] = [];
  const wrong = decisionHistory.filter(d => !d.wasCorrect);

  if (wrong.length < 2) return detected;

  // A1 — Apego à Mão: calls when should fold/raise
  const apegoHands = wrong.filter(d => {
    const acted = d.playerAction.toLowerCase();
    const correct = d.correctAction.toLowerCase();
    return acted.includes('call') && (correct.includes('fold') || correct.includes('raise'));
  });
  if (apegoHands.length >= 2) {
    detected.push({
      leak: COGNITIVE_LEAKS.A1,
      confidence: Math.min(95, 50 + apegoHands.length * 15),
      occurrences: apegoHands.length,
      recentHands: apegoHands.map((_, i) => i + 1),
      evLost: `~${(apegoHands.length * 0.4).toFixed(1)} BB`,
      reprogramming: 'Quando a ação correta é fold, largar é lucro. Equity negativa não melhora com esperança.',
    });
  }

  // A2 — Overplay: raises/all-ins when should call/check
  const overplayHands = wrong.filter(d => {
    const acted = d.playerAction.toLowerCase();
    const correct = d.correctAction.toLowerCase();
    return (acted.includes('raise') || acted.includes('all-in')) && (correct.includes('call') || correct.includes('check'));
  });
  if (overplayHands.length >= 2) {
    detected.push({
      leak: COGNITIVE_LEAKS.A2,
      confidence: Math.min(95, 50 + overplayHands.length * 15),
      occurrences: overplayHands.length,
      recentHands: overplayHands.map((_, i) => i + 1),
      evLost: `~${(overplayHands.length * 0.5).toFixed(1)} BB`,
      reprogramming: 'Controle a euforia. O valor está na decisão ótima, não na agressão descontrolada.',
    });
  }

  // B1 — Medo de Matar Ação: bet small when should bet big (or check when should bet)
  const medoHands = wrong.filter(d => {
    const acted = d.playerAction.toLowerCase();
    const correct = d.correctAction.toLowerCase();
    return (acted.includes('check') || acted.includes('call')) && (correct.includes('bet') || correct.includes('raise'));
  });
  if (medoHands.length >= 2) {
    detected.push({
      leak: COGNITIVE_LEAKS.B1,
      confidence: Math.min(95, 50 + medoHands.length * 15),
      occurrences: medoHands.length,
      recentHands: medoHands.map((_, i) => i + 1),
      evLost: `~${(medoHands.length * 0.4).toFixed(1)} BB`,
      reprogramming: 'Quando você está à frente, o fold do vilão é lucro, não fracasso. Aposte pelo valor máximo.',
    });
  }

  // B2 — Passividade: check/call em spots de raise
  const passividadeHands = wrong.filter(d => {
    const acted = d.playerAction.toLowerCase();
    const correct = d.correctAction.toLowerCase();
    return acted.includes('check') && correct.includes('bet');
  });
  if (passividadeHands.length >= 2 && !detected.some(d => d.leak.code === 'B1')) {
    detected.push({
      leak: COGNITIVE_LEAKS.B2,
      confidence: Math.min(90, 45 + passividadeHands.length * 12),
      occurrences: passividadeHands.length,
      recentHands: passividadeHands.map((_, i) => i + 1),
      evLost: `~${(passividadeHands.length * 0.3).toFixed(1)} BB`,
      reprogramming: 'Ambiguidade é normal. Aposte com frequência calculada, não com certeza absoluta.',
    });
  }

  // C2 — Refusal to Fold: não faz fold quando deveria
  const noFoldHands = wrong.filter(d => {
    const correct = d.correctAction.toLowerCase();
    const acted = d.playerAction.toLowerCase();
    return correct.includes('fold') && !acted.includes('fold');
  });
  if (noFoldHands.length >= 2) {
    detected.push({
      leak: COGNITIVE_LEAKS.C2,
      confidence: Math.min(95, 50 + noFoldHands.length * 15),
      occurrences: noFoldHands.length,
      recentHands: noFoldHands.map((_, i) => i + 1),
      evLost: `~${(noFoldHands.length * 0.6).toFixed(1)} BB`,
      reprogramming: 'Sunk cost é ilusão. Cada street é uma decisão nova. Fold disciplinado é uma habilidade.',
    });
  }

  // Sort by confidence descending
  detected.sort((a, b) => b.confidence - a.confidence);
  return detected.slice(0, 3); // Top 3
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Analyze the current decision against patterns and return a per-decision leak if detected.
 */
export function analyzeDecisionForLeak(record: DecisionRecord): DetectedLeak | null {
  recordDecision(record);
  
  // Need at least 3 decisions for pattern detection
  if (decisionHistory.length < 3) return null;

  const leaks = detectLeaks();
  return leaks.length > 0 ? leaks[0] : null;
}

/**
 * Get all currently detected leaks for session summary.
 */
export function getSessionLeaks(): DetectedLeak[] {
  return detectLeaks();
}

/**
 * Get the decision history count.
 */
export function getDecisionCount(): number {
  return decisionHistory.length;
}
