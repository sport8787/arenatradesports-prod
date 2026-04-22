/**
 * Validação de sinais por janela temporal.
 * Sinais de 1º tempo (HT/1T/Primeiro Tempo) deixam de valer após o intervalo.
 */

const HT_REGEX = /\b(ht|1t|1º\s*tempo|primeiro\s*tempo|first\s*half|halftime|half\s*time|intervalo)\b/i;

export function isFirstHalfMarket(market?: string | null): boolean {
  if (!market || typeof market !== "string") return false;
  return HT_REGEX.test(market);
}

/**
 * Retorna true se o sinal é uma entrada de 1º tempo e o jogo já passou do
 * minuto 45 (ou está no 2º tempo / encerrado).
 */
export function isExpiredHtSignal(params: {
  market?: string | null;
  minute?: number | null;
  period?: string | null;
  status?: string | null;
}): boolean {
  if (!isFirstHalfMarket(params.market)) return false;

  const min = params.minute ?? 0;
  const period = (params.period || "").toLowerCase();
  const status = (params.status || "").toLowerCase();

  if (status === "finished") return true;
  if (min >= 45) return true;
  if (
    period.includes("second") ||
    period.includes("2nd") ||
    period.includes("2t") ||
    period.includes("ht") || // halftime
    period.includes("intervalo")
  ) {
    return true;
  }
  return false;
}
