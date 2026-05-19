import type { DeckCount, Penetration } from './liveTypes';

export function totalCards(decks: DeckCount) {
  return decks * 52;
}

export function decksRemainingEstimate(decks: DeckCount, cardsSeen: number) {
  const remaining = Math.max(0, totalCards(decks) - cardsSeen);
  return Math.max(0.5, remaining / 52);
}

export function penetrationReached(decks: DeckCount, penetration: Penetration, cardsSeen: number) {
  return cardsSeen / totalCards(decks) >= penetration;
}

export function penetrationLabel(p: Penetration) {
  if (p === 0.60) return 'Conservadora (60%)';
  if (p === 0.75) return 'Média (75%)';
  return 'Profunda (85%)';
}
