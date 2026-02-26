// ══════════════════════════════════════════════════════════
// BLACKJACK DECISION ENGINE
// Tabela básica + Desvios True Count (Illustrious 18)
// Inclui Surrender (CashOut) e correções para soft hands
// ══════════════════════════════════════════════════════════

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface Hand {
  cards: string[];
  total: number;
  soft: boolean;
  canSplit: boolean;
  canDouble: boolean;
  canSurrender: boolean;
}

export interface Decision {
  action: Action;
  confidence: number;
  isDeviation: boolean;
  explanation: string;
  trueCount?: number;
}

const BASIC_STRATEGY: Record<string, Record<string, Action>> = {
  'hard_5-8': {
    '2': 'hit', '3': 'hit', '4': 'hit', '5': 'hit', '6': 'hit',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'hard_9': {
    '2': 'hit', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'hard_10': {
    '2': 'double', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'double', '8': 'double', '9': 'double', '10': 'hit', 'A': 'hit'
  },
  'hard_11': {
    '2': 'double', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'double', '8': 'double', '9': 'double', '10': 'double', 'A': 'double'
  },
  'hard_12': {
    '2': 'hit', '3': 'hit', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'hard_13': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'hard_14': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'hard_15': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'surrender', 'A': 'surrender'
  },
  'hard_16': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'hit', '8': 'hit', '9': 'surrender', '10': 'surrender', 'A': 'surrender'
  },
  'hard_17-21': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'stand', '8': 'stand', '9': 'stand', '10': 'stand', 'A': 'stand'
  },
  'soft_13-14': {
    '2': 'hit', '3': 'hit', '4': 'hit', '5': 'double', '6': 'double',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'soft_15-16': {
    '2': 'hit', '3': 'hit', '4': 'double', '5': 'double', '6': 'double',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'soft_17': {
    '2': 'hit', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'soft_18': {
    '2': 'stand', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'stand', '8': 'stand', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'soft_19-21': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'stand', '8': 'stand', '9': 'stand', '10': 'stand', 'A': 'stand'
  },
  'pair_2-2': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'split', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'pair_3-3': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'split', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'pair_4-4': {
    '2': 'hit', '3': 'hit', '4': 'hit', '5': 'split', '6': 'split',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'pair_5-5': {
    '2': 'double', '3': 'double', '4': 'double', '5': 'double', '6': 'double',
    '7': 'double', '8': 'double', '9': 'double', '10': 'hit', 'A': 'hit'
  },
  'pair_6-6': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'hit', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'pair_7-7': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'split', '8': 'hit', '9': 'hit', '10': 'hit', 'A': 'hit'
  },
  'pair_8-8': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'split', '8': 'split', '9': 'split', '10': 'split', 'A': 'split'
  },
  'pair_9-9': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'stand', '8': 'split', '9': 'split', '10': 'stand', 'A': 'stand'
  },
  'pair_10-10': {
    '2': 'stand', '3': 'stand', '4': 'stand', '5': 'stand', '6': 'stand',
    '7': 'stand', '8': 'stand', '9': 'stand', '10': 'stand', 'A': 'stand'
  },
  'pair_A-A': {
    '2': 'split', '3': 'split', '4': 'split', '5': 'split', '6': 'split',
    '7': 'split', '8': 'split', '9': 'split', '10': 'split', 'A': 'split'
  }
};

interface Deviation {
  hand: number | string;
  dealer: number | string;
  trueCount: number;
  basicAction: Action;
  deviationAction: Action;
  explanation: string;
}

const ILLUSTRIOUS_18: Deviation[] = [
  { hand: 16, dealer: 10, trueCount: 0, basicAction: 'hit', deviationAction: 'stand', explanation: 'Com TC 0+, baralho rico em altas. Dealer estoura mais.' },
  { hand: 15, dealer: 10, trueCount: 4, basicAction: 'hit', deviationAction: 'stand', explanation: 'Com TC +4, baralho muito rico. Risco de estouro maior.' },
  { hand: 12, dealer: 3, trueCount: 2, basicAction: 'hit', deviationAction: 'stand', explanation: 'TC +2: cartas altas favorecem dealer estourar.' },
  { hand: 12, dealer: 2, trueCount: 3, basicAction: 'hit', deviationAction: 'stand', explanation: 'TC +3: dealer estoura mais frequentemente.' },
  { hand: 11, dealer: 'A', trueCount: 1, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +1: dobrar contra Ás é vantajoso.' },
  { hand: 9, dealer: 2, trueCount: 1, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +1: dobrar 9 contra 2 é lucrativo.' },
  { hand: 10, dealer: 10, trueCount: 4, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +4: alta chance de receber 20 ou 21.' },
  { hand: 10, dealer: 'A', trueCount: 4, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +4: dobrar contra Ás.' },
  { hand: 9, dealer: 7, trueCount: 3, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +3: dobrar 9 contra 7.' },
  { hand: 16, dealer: 9, trueCount: 5, basicAction: 'hit', deviationAction: 'stand', explanation: 'TC +5: evitar estouro.' },
  { hand: 13, dealer: 2, trueCount: -1, basicAction: 'stand', deviationAction: 'hit', explanation: 'TC -1: comprar é melhor.' },
  { hand: 12, dealer: 4, trueCount: 0, basicAction: 'stand', deviationAction: 'hit', explanation: 'TC 0: comprar ligeiramente melhor.' },
  { hand: 12, dealer: 5, trueCount: -2, basicAction: 'stand', deviationAction: 'hit', explanation: 'TC -2: comprar.' },
  { hand: 12, dealer: 6, trueCount: -1, basicAction: 'stand', deviationAction: 'hit', explanation: 'TC -1: comprar.' },
  { hand: 13, dealer: 3, trueCount: -2, basicAction: 'stand', deviationAction: 'hit', explanation: 'TC -2: comprar.' },
  { hand: 'soft_18', dealer: 2, trueCount: 1, basicAction: 'stand', deviationAction: 'double', explanation: 'TC +1: dobrar soft 18 contra 2.' },
  { hand: 'soft_17', dealer: 2, trueCount: 1, basicAction: 'hit', deviationAction: 'double', explanation: 'TC +1: dobrar soft 17.' }
];

export function getOptimalDecision(
  playerHand: Hand,
  dealerCard: string,
  trueCount: number = 0
): Decision {
  const dealerValue = getCardValue(dealerCard);

  const deviation = checkForDeviation(playerHand, dealerValue, trueCount);
  if (deviation) {
    if (deviation.deviationAction === 'surrender' && !playerHand.canSurrender) {
      return {
        action: deviation.basicAction,
        confidence: 100,
        isDeviation: false,
        explanation: getBasicExplanation(playerHand, dealerValue, deviation.basicAction),
        trueCount
      };
    }
    return {
      action: deviation.deviationAction,
      confidence: 95,
      isDeviation: true,
      explanation: deviation.explanation,
      trueCount
    };
  }

  let basicAction = getBasicStrategyAction(playerHand, dealerValue);

  if (basicAction === 'surrender' && !playerHand.canSurrender) {
    basicAction = 'hit';
  }

  return {
    action: basicAction,
    confidence: 100,
    isDeviation: false,
    explanation: getBasicExplanation(playerHand, dealerValue, basicAction),
    trueCount
  };
}

function checkForDeviation(hand: Hand, dealerValue: number | string, trueCount: number): Deviation | null {
  for (const dev of ILLUSTRIOUS_18) {
    let handMatches = false;
    if (typeof dev.hand === 'string') {
      handMatches = hand.soft && `soft_${hand.total}` === dev.hand;
    } else {
      handMatches = !hand.soft && hand.total === dev.hand;
    }
    const dealerMatches = dev.dealer === dealerValue;
    const tcMatches = dev.trueCount >= 0 ? trueCount >= dev.trueCount : trueCount <= dev.trueCount;
    if (handMatches && dealerMatches && tcMatches) return dev;
  }
  return null;
}

function getBasicStrategyAction(hand: Hand, dealerValue: number | string): Action {
  const category = getHandCategory(hand);
  const dealerKey = dealerValue.toString();
  return BASIC_STRATEGY[category]?.[dealerKey] || 'hit';
}

function getHandCategory(hand: Hand): string {
  if (hand.canSplit) {
    const cardValue = getCardValue(hand.cards[0]);
    return `pair_${cardValue}-${cardValue}`;
  }
  if (hand.soft) {
    if (hand.total <= 14) return 'soft_13-14';
    if (hand.total <= 16) return 'soft_15-16';
    if (hand.total === 17) return 'soft_17';
    if (hand.total === 18) return 'soft_18';
    return 'soft_19-21';
  }
  if (hand.total <= 8) return 'hard_5-8';
  if (hand.total === 9) return 'hard_9';
  if (hand.total === 10) return 'hard_10';
  if (hand.total === 11) return 'hard_11';
  if (hand.total === 12) return 'hard_12';
  if (hand.total === 13) return 'hard_13';
  if (hand.total === 14) return 'hard_14';
  if (hand.total === 15) return 'hard_15';
  if (hand.total === 16) return 'hard_16';
  return 'hard_17-21';
}

export function getCardValue(card: string): number | string {
  const rank = card.slice(0, -1);
  if (rank === 'A') return 'A';
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank);
}

export function calculateHandTotal(cards: string[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = getCardValue(card);
    if (value === 'A') { aces++; total += 11; }
    else { total += typeof value === 'number' ? value : 0; }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 && total <= 21 };
}

function getBasicExplanation(hand: Hand, dealer: number | string, action: Action): string {
  const actionText: Record<Action, string> = {
    hit: 'COMPRAR', stand: 'PARAR', double: 'DOBRAR', split: 'SEPARAR', surrender: 'RENDER (CashOut)'
  };
  if (hand.canSplit) return `Par de ${getCardValue(hand.cards[0])}s contra ${dealer}: ${actionText[action]} é a jogada ótima.`;
  if (hand.soft) return `Soft ${hand.total} contra ${dealer}: ${actionText[action]} maximiza expectativa.`;
  return `${hand.total} contra ${dealer}: ${actionText[action]} é a decisão correta.`;
}
