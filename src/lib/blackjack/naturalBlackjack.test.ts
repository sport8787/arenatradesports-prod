import { describe, it, expect } from "vitest";
import {
  isNaturalBlackjack,
  resolveAfterDealerHoleCard,
} from "./naturalBlackjack";

describe("isNaturalBlackjack", () => {
  it("A + 10-valued card with 2 cards is natural BJ", () => {
    expect(isNaturalBlackjack(["AS", "JH"])).toBe(true);
    expect(isNaturalBlackjack(["AH", "TD"])).toBe(true);
    expect(isNaturalBlackjack(["AC", "QS"])).toBe(true);
    expect(isNaturalBlackjack(["AD", "KH"])).toBe(true);
    expect(isNaturalBlackjack(["JH", "AS"])).toBe(true); // ordem indiferente
  });

  it("21 com 3+ cartas NÃO é blackjack natural", () => {
    expect(isNaturalBlackjack(["7H", "7D", "7S"])).toBe(false); // 21 em 3 cartas
    expect(isNaturalBlackjack(["AS", "5D", "5H"])).toBe(false); // A+5+5 = 21
    expect(isNaturalBlackjack(["5H", "6D", "JC"])).toBe(false); // 5+6+10 = 21
    expect(isNaturalBlackjack(["AS", "2D", "8H"])).toBe(false); // A+2+8 = 21
    expect(isNaturalBlackjack(["AS", "3D", "7H"])).toBe(false); // A+3+7 = 21
    expect(isNaturalBlackjack(["2H", "3D", "6S", "JC"])).toBe(false); // 4 cartas
  });

  it("2 cartas sem 21 não é blackjack natural", () => {
    expect(isNaturalBlackjack(["AS", "9H"])).toBe(false); // 20
    expect(isNaturalBlackjack(["JH", "QD"])).toBe(false); // 20
    expect(isNaturalBlackjack(["AS", "AD"])).toBe(false); // 12 soft
    expect(isNaturalBlackjack(["5H", "5D"])).toBe(false); // par 10
  });

  it("menos de 2 cartas nunca é blackjack", () => {
    expect(isNaturalBlackjack([])).toBe(false);
    expect(isNaturalBlackjack(["AS"])).toBe(false);
  });
});

describe("resolveAfterDealerHoleCard", () => {
  const player = ["AS", "JH"]; // BJ natural

  it("encerra com BLACKJACK quando dealer NÃO tem natural (ex.: 4 + 3)", () => {
    expect(resolveAfterDealerHoleCard(player, ["4D", "3C"], false)).toBe("blackjack");
  });

  it("encerra com BLACKJACK mesmo se dealer fizer 21 com 3+ cartas (cenário hipotético: paga 1.5:1 pois jogador encerra antes)", () => {
    // O dealer só joga se o jogador não tiver BJ; mas garantimos: a função encerra com a 2ª carta.
    expect(resolveAfterDealerHoleCard(player, ["TS", "9D"], false)).toBe("blackjack"); // dealer 19
    expect(resolveAfterDealerHoleCard(player, ["6H", "AC"], false)).toBe("blackjack"); // dealer soft 17
  });

  it("PUSH quando dealer também tem blackjack natural (A+10/J/Q/K)", () => {
    expect(resolveAfterDealerHoleCard(player, ["AC", "KS"], false)).toBe("push");
    expect(resolveAfterDealerHoleCard(player, ["TH", "AD"], false)).toBe("push");
    expect(resolveAfterDealerHoleCard(player, ["AS", "JC"], false)).toBe("push");
    expect(resolveAfterDealerHoleCard(player, ["QC", "AH"], false)).toBe("push");
  });

  it("CONTINUE quando jogador NÃO tem BJ natural (21 em 3+ cartas)", () => {
    expect(resolveAfterDealerHoleCard(["7H", "7D", "7S"], ["4D", "3C"], false)).toBe("continue");
    expect(resolveAfterDealerHoleCard(["AS", "5D", "5H"], ["JH", "8D"], false)).toBe("continue");
  });

  it("CONTINUE quando jogador tem 2 cartas mas não soma 21", () => {
    expect(resolveAfterDealerHoleCard(["AS", "9H"], ["4D", "3C"], false)).toBe("continue"); // 20
    expect(resolveAfterDealerHoleCard(["JH", "QD"], ["4D", "3C"], false)).toBe("continue"); // 20
  });

  it("split: 21 com 2 cartas NÃO conta como BJ natural — sempre CONTINUE", () => {
    expect(resolveAfterDealerHoleCard(["AS", "JH"], ["4D", "3C"], true)).toBe("continue");
    expect(resolveAfterDealerHoleCard(["AS", "KH"], ["AC", "QS"], true)).toBe("continue");
  });

  it("dealer com 10/J/Q/K + carta baixa (sem A) — não é push", () => {
    expect(resolveAfterDealerHoleCard(player, ["TS", "5D"], false)).toBe("blackjack");
    expect(resolveAfterDealerHoleCard(player, ["KS", "6D"], false)).toBe("blackjack");
    expect(resolveAfterDealerHoleCard(player, ["JC", "2H"], false)).toBe("blackjack");
    expect(resolveAfterDealerHoleCard(player, ["QH", "7D"], false)).toBe("blackjack");
  });

  it("dealer com A + carta baixa (sem 10) — não é push", () => {
    expect(resolveAfterDealerHoleCard(player, ["AS", "5D"], false)).toBe("blackjack"); // soft 16
    expect(resolveAfterDealerHoleCard(player, ["AS", "6D"], false)).toBe("blackjack"); // soft 17
    expect(resolveAfterDealerHoleCard(player, ["AS", "9D"], false)).toBe("blackjack"); // soft 20
  });
});
