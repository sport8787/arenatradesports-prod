/**
 * @deprecated Substituído por `futodds-live-odd` / `futodds-live-odds` (odds reais Betfair).
 * Mantido APENAS como fallback offline para Over/Under quando todas as edges falham.
 * Nenhum código novo deve depender deste estimador. Ver MatchCardWithEntries.handleConfirm
 * para a cadeia preferida (futodds → sportmonks → estimador).
 *
 * Estimativa de odd ao vivo para mercados Over/Under via Poisson simplificada.
 * Fallback usado quando a Sportmonks/The Odds API não retorna odd para o mercado.
 *
 * Inputs:
 *  - oddPre:  odd pré-jogo do mercado (ex: 1.85). Default 1.85.
 *  - linha:   linha do mercado (0.5, 1.5, 2.5, 3.5).
 *  - minuto:  minuto atual do jogo (0-90+).
 *  - golsAtuais: gols totais já marcados.
 *  - tipo: 'over' | 'under'.
 *  - margem: margem de juice (default 0.05 = 5%).
 */
export interface EstimateLiveOddInput {
  oddPre?: number;
  linha: number;
  minuto: number;
  golsAtuais: number;
  tipo: 'over' | 'under';
  margem?: number;
}

function preOddsToLambda(oddPre: number, linha: number): number {
  // Tabela empírica para Over 2.5
  let base: number;
  if (oddPre <= 1.25) base = 4.2;
  else if (oddPre <= 1.35) base = 3.8;
  else if (oddPre <= 1.45) base = 3.4;
  else if (oddPre <= 1.55) base = 3.1;
  else if (oddPre <= 1.65) base = 2.9;
  else if (oddPre <= 1.75) base = 2.7;
  else if (oddPre <= 1.85) base = 2.5;
  else if (oddPre <= 2.0) base = 2.3;
  else base = 2.0;

  // Ajuste por linha
  if (linha === 1.5) base += 0.3;
  else if (linha === 0.5) base += 0.6;
  else if (linha === 3.5) base -= 0.3;
  return Math.max(0.5, Math.min(6.0, base));
}

/** CDF Poisson exata até k. */
function poissonCdf(k: number, mu: number): number {
  if (mu <= 0) return 1;
  let sum = 0;
  let term = Math.exp(-mu);
  sum = term;
  for (let i = 1; i <= k; i++) {
    term *= mu / i;
    sum += term;
  }
  return Math.min(1, Math.max(0, sum));
}

export function estimateLiveOdd(input: EstimateLiveOddInput): number {
  const oddPre = input.oddPre && input.oddPre > 1.01 ? input.oddPre : 1.85;
  const linha = input.linha;
  const minuto = Math.max(0, Math.min(90, input.minuto));
  const golsAtuais = Math.max(0, input.golsAtuais);
  const tipo = input.tipo;
  const margem = input.margem ?? 0.05;

  const lambdaTotal = preOddsToLambda(oddPre, linha);
  const golsEsperadosAteAgora = (lambdaTotal * minuto) / 90;
  const desvio = golsAtuais - golsEsperadosAteAgora;

  // Fator placar: jogo "quente" (mais gols que esperado) eleva λ restante
  const fatorPlacar = Math.max(0.4, 1 + 0.6 * desvio);
  const lambdaRestante = Math.max(
    0.05,
    (lambdaTotal * (90 - minuto)) / 90 * fatorPlacar,
  );

  const golsNecessarios = Math.max(0, Math.ceil(linha - golsAtuais));
  let probOver: number;
  if (golsNecessarios === 0) {
    probOver = 0.99; // já hit
  } else {
    // P(X >= k) = 1 - CDF(k-1)
    probOver = 1 - poissonCdf(golsNecessarios - 1, lambdaRestante);
  }

  const prob = tipo === 'over' ? probOver : 1 - probOver;
  const probClamp = Math.min(0.98, Math.max(0.02, prob));
  const odd = (1 / probClamp) * (1 + margem);
  return Math.round(odd * 100) / 100;
}

export function extrairLinha(market: string | null | undefined): number | null {
  if (!market) return null;
  const m = market.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

export function extrairTipo(market: string | null | undefined): 'over' | 'under' | null {
  if (!market) return null;
  const m = market.toLowerCase();
  if (m.includes('over')) return 'over';
  if (m.includes('under')) return 'under';
  return null;
}
