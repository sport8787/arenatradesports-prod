// Critérios B1-B5 compartilhados entre MatchCard, CompactMatchTable e modal de detalhes.
// Mantém uma única fonte de verdade para a lógica visual dos indicadores.
import type { Match } from '@/components/dashboard/MatchCard';

export type CriteriaState = 'green' | 'red' | 'yellow' | 'gray';

export interface CriteriaResult {
  key: 'b1' | 'b2' | 'b3' | 'b4' | 'b5';
  label: string;
  shortLabel: string;
  state: CriteriaState;
  detail: string;
  source: string;       // qual dado foi usado para decidir
  vetoReason?: string;  // explicação curta para tooltip/badge
  eliminatory?: boolean;
  description: string;  // explicação longa para o modal
}

const HT_REGEX = /\b(intervalo|halftime|half_time|ht)\b/i;

function isHalftimePeriod(period?: string | null) {
  if (!period) return false;
  const p = String(period).toLowerCase();
  return HT_REGEX.test(p);
}

export function computeCriteria(match: Match): CriteriaResult[] {
  const s = match.stats;
  const status = match.mycroftStatus;
  const isApproved =
    status === 'APROVADO' ||
    status === 'APROVADO_SITUACIONAL' ||
    status === 'opportunity' ||
    status === 'LABAREDA';
  const isVetoed = status === 'VETADO' || status === 'JOGO_MORTO' || status === 'no_value';
  const conf = match.confidence ?? null;
  const isHalftime = isHalftimePeriod(match.period);

  // B1 — Poisson ≥ 40% (eliminatório)
  let b1State: CriteriaState = 'gray';
  let b1Detail = 'Aguardando análise Poisson';
  let b1Source = 'confidence: —';
  let b1Veto: string | undefined;
  if (conf != null) {
    b1Detail = `Probabilidade ${conf}%`;
    b1Source = `confidence = ${conf}%`;
    if (conf >= 40) b1State = 'green';
    else if (conf >= 30) {
      b1State = 'yellow';
      b1Veto = `prob. abaixo do alvo (${conf}%)`;
    } else {
      b1State = 'red';
      b1Veto = `prob. ${conf}% < 40%`;
    }
  } else if (isApproved) {
    b1State = 'green';
    b1Detail = 'Aprovado pelo motor (≥40%)';
    b1Source = 'mycroftStatus = ' + status;
  } else if (isVetoed) {
    b1State = 'red';
    b1Detail = 'Vetado pelo motor';
    b1Source = 'mycroftStatus = ' + status;
    b1Veto = 'probabilidade Poisson abaixo do alvo';
  }

  // B2 — Valor Esperado positivo (eliminatório)
  let b2State: CriteriaState = 'gray';
  let b2Detail = 'EV pendente';
  let b2Source = 'edge function ainda não decidiu';
  let b2Veto: string | undefined;
  if (isApproved) {
    b2State = 'green';
    b2Detail = 'EV positivo (edge > 0)';
    b2Source = 'mycroftStatus = ' + status + ' implica EV+';
  } else if (isVetoed) {
    b2State = 'red';
    b2Detail = 'EV negativo (edge ≤ 0)';
    b2Source = 'mycroftStatus = ' + status + ' implica EV-';
    b2Veto = 'sem valor esperado positivo';
  }

  // B3 — Situacional S1-S4
  let b3State: CriteriaState = 'gray';
  let b3Detail = 'Sem padrão situacional ativo';
  let b3Source = 'alerts: ' + ((match.alerts || []).join(' | ') || '—');
  if (status === 'APROVADO_SITUACIONAL') {
    b3State = 'green';
    b3Detail = 'Padrão S1-S4 confirmado pelo motor';
    b3Source = 'mycroftStatus = APROVADO_SITUACIONAL';
  } else {
    const sit = (match.alerts || []).find((a) => /\bS[1-4]\b/i.test(a));
    if (sit) {
      b3State = 'green';
      b3Detail = sit;
      b3Source = 'alert: "' + sit + '"';
    } else if (isApproved) {
      b3State = 'yellow';
      b3Detail = 'Aprovado, mas sem padrão situacional explícito';
    }
  }

  // B4 — Janela de tempo válida 10-70', não HT (eliminatório)
  let b4State: CriteriaState;
  let b4Detail = `Minuto ${match.minute}`;
  const b4Source = `minute = ${match.minute} · period = ${match.period || '—'}`;
  let b4Veto: string | undefined;
  if (isHalftime) {
    b4State = 'red';
    b4Detail = 'Intervalo (HT)';
    b4Veto = 'janela inválida (intervalo)';
  } else if (match.minute >= 10 && match.minute <= 65) {
    b4State = 'green';
  } else if (match.minute > 65 && match.minute <= 70) {
    b4State = 'yellow';
    b4Veto = `janela fechando (${match.minute}')`;
  } else if (match.minute > 70) {
    b4State = 'red';
    b4Veto = `fora da janela (${match.minute}')`;
  } else {
    b4State = 'gray';
    b4Detail = `${match.minute}' (cedo demais)`;
  }

  // B5 — Stats ao vivo (Pressão + dentro da área)
  let b5State: CriteriaState = 'gray';
  let b5Detail = 'Stats indisponíveis';
  let b5Source = 'sem chutes/escanteios/ataques no payload';
  const shots = s?.shots_home;
  const corners = s?.corners_home;
  const atk = s?.attacks_home;
  const atkOpp = s?.attacks_away;
  if (shots != null || corners != null || atk != null) {
    const sH = shots ?? 0;
    const cH = corners ?? 0;
    const aH = atk ?? 0;
    const aA = atkOpp ?? 0;
    b5Detail = `${sH} chutes · ${cH} escanteios${aH || aA ? ` · ataques ${aH}v${aA}` : ''}`;
    b5Source = `shots=${sH}, corners=${cH}, attacks ${aH}v${aA}`;
    const pressao = sH >= 3 || cH >= 3;
    const dentroArea = aH > aA * 1.2 || sH >= 4;
    if (pressao && dentroArea) b5State = 'green';
    else if (pressao || dentroArea) b5State = 'yellow';
    else if (sH === 0 && cH === 0 && aH < aA) b5State = 'red';
    else b5State = 'gray';
  }

  return [
    {
      key: 'b1',
      label: 'B1 · Poisson ≥ 40%',
      shortLabel: 'B1 Poisson',
      state: b1State,
      detail: b1Detail,
      source: b1Source,
      vetoReason: b1Veto,
      eliminatory: true,
      description:
        'Probabilidade estimada pelo modelo Poisson Bivariado precisa ser ≥ 40% para considerar a entrada matematicamente viável. Critério eliminatório.',
    },
    {
      key: 'b2',
      label: 'B2 · EV positivo',
      shortLabel: 'B2 EV+',
      state: b2State,
      detail: b2Detail,
      source: b2Source,
      vetoReason: b2Veto,
      eliminatory: true,
      description:
        'Valor Esperado (probabilidade × odd − 1) precisa ser positivo. Sem edge, não há vantagem teórica de longo prazo. Critério eliminatório.',
    },
    {
      key: 'b3',
      label: 'B3 · Situacional S1-S4',
      shortLabel: 'B3 Situacional',
      state: b3State,
      detail: b3Detail,
      source: b3Source,
      description:
        'Confirma um padrão situacional reconhecido pelo Mycroft: S1 (Pressão Sustentada), S2 (Time Forte Atrás), S3 (Final Aberto), S4 (Defesa Quebrando). Qualifica a entrada — não veta sozinho.',
    },
    {
      key: 'b4',
      label: "B4 · Janela 10-70'",
      shortLabel: 'B4 Janela',
      state: b4State,
      detail: b4Detail,
      source: b4Source,
      vetoReason: b4Veto,
      eliminatory: true,
      description:
        "Apenas entradas entre o minuto 10 e 70 com bola rolando são aceitas. Antes de 10' não há amostragem; depois de 70' o tempo é insuficiente; intervalo (HT) é inválido. Critério eliminatório.",
    },
    {
      key: 'b5',
      label: 'B5 · Stats (pressão + área)',
      shortLabel: 'B5 Stats',
      state: b5State,
      detail: b5Detail,
      source: b5Source,
      description:
        'Confirma que o jogo ao vivo está produzindo pressão (≥3 chutes ou ≥3 escanteios) E volume dentro da área (ataques perigosos 20% acima do adversário ou ≥4 chutes). Qualifica — não veta sozinho.',
    },
  ];
}

export function getCriteriaSummary(criteria: CriteriaResult[]) {
  const greens = criteria.filter((c) => c.state === 'green').length;
  const eliminatoryFailed = criteria.some((c) => c.eliminatory && c.state === 'red');
  const vetoSummary = criteria.find((c) => c.state === 'red' && c.vetoReason)?.vetoReason ?? null;
  return { greens, eliminatoryFailed, vetoSummary };
}
