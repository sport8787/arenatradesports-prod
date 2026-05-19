/**
 * Pure helpers for "natural blackjack" (21 with the first 2 cards) resolution.
 *
 * Regras canônicas usadas pela Arena Blackjack:
 *  - Blackjack natural = exatamente 2 cartas totalizando 21 (ex.: A+10/J/Q/K).
 *  - 21 obtido com 3+ cartas NÃO é blackjack natural (paga 1:1).
 *  - Em split, uma mão de 2 cartas somando 21 NÃO é blackjack natural (paga 1:1).
 *  - Após o jogador ter BJ natural, a 2ª carta do dealer é coletada apenas
 *    para fins de contagem e a mão encerra imediatamente:
 *      • PUSH se o dealer também tiver blackjack natural (2 cartas = 21);
 *      • BLACKJACK (pagamento 1.5:1) caso contrário.
 */

import { calculateHandTotal } from "./decision-engine";

export type NaturalResolution = "blackjack" | "push" | "continue";

/** True quando exatamente 2 cartas somam 21. */
export function isNaturalBlackjack(cards: string[]): boolean {
  if (cards.length !== 2) return false;
  return calculateHandTotal(cards).total === 21;
}

/**
 * Decide o que fazer assim que o dealer revela a 2ª carta (hole card).
 *
 * @param playerCards cartas do jogador (na mão principal — split não conta como natural)
 * @param dealerCards cartas do dealer já reveladas, incluindo a hole card
 * @param splitMode   true se o jogador entrou em modo split
 */
export function resolveAfterDealerHoleCard(
  playerCards: string[],
  dealerCards: string[],
  splitMode: boolean,
): NaturalResolution {
  if (splitMode) return "continue";
  if (!isNaturalBlackjack(playerCards)) return "continue";
  // Jogador tem BJ natural — encerra independente do total do dealer.
  if (isNaturalBlackjack(dealerCards)) return "push";
  return "blackjack";
}
