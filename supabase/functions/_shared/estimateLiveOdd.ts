// Estimador de odd ao vivo (Poisson simplificada) — fallback para popular
// mycroft_analyses.odd quando o modelo não retorna odd numérica válida.
// Garante que o ROI por unidade no painel de calibração seja calculável.

export interface EstimateLiveOddInput {
  oddPre?: number;
  linha: number;
  minuto: number;
  golsAtuais: number;
  tipo: 'over' | 'under';
  margem?: number;
}

function preOddsToLambda(oddPre: number, linha: number): number {
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
  if (linha === 1.5) base += 0.3;
  else if (linha === 0.5) base += 0.6;
  else if (linha === 3.5) base -= 0.3;
  return Math.max(0.5, Math.min(6.0, base));
}

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
  const fatorPlacar = Math.max(0.4, 1 + 0.6 * desvio);
  const lambdaRestante = Math.max(0.05, (lambdaTotal * (90 - minuto)) / 90 * fatorPlacar);
  const golsNecessarios = Math.max(0, Math.ceil(linha - golsAtuais));
  let probOver: number;
  if (golsNecessarios === 0) probOver = 0.99;
  else probOver = 1 - poissonCdf(golsNecessarios - 1, lambdaRestante);
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

/**
 * Resolve uma odd "garantida" para qualquer mercado, usada como fallback ao
 * gravar em mycroft_analyses. Nunca retorna < 1.20.
 *
 * Heurística:
 *  - Over/Under XX → estimateLiveOdd via Poisson (usa minuto + placar).
 *  - BTTS Sim → 1.75 ; BTTS Não → 1.95
 *  - Vitória Casa/Fora/Empate → 2.20
 *  - Escanteios Over → 1.85
 *  - Demais → 1.85 (média de mercado)
 */
export function resolveFallbackOdd(opts: {
  market: string | null | undefined;
  minute: number;
  scoreHome: number;
  scoreAway: number;
}): number {
  const market = (opts.market || '').toLowerCase();
  const tipo = extrairTipo(market);
  const linha = extrairLinha(market);
  if (tipo && linha != null) {
    try {
      const golsAtuais = (opts.scoreHome ?? 0) + (opts.scoreAway ?? 0);
      const odd = estimateLiveOdd({
        linha,
        minuto: opts.minute ?? 0,
        golsAtuais,
        tipo,
      });
      if (odd >= 1.2 && odd <= 50) return odd;
    } catch { /* ignore */ }
  }
  if (market.includes('btts') || market.includes('ambas')) {
    return market.includes('não') || market.includes('nao') || market.includes('no') ? 1.95 : 1.75;
  }
  if (market.includes('escante') || market.includes('corner')) return 1.85;
  if (market.includes('vitória') || market.includes('vitoria') || market.includes('home') || market.includes('away') || market.includes('empate') || market.includes('draw')) return 2.20;
  return 1.85;
}
