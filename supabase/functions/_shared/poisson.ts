// ═══ POISSON BIVARIADA — Módulo Compartilhado ═══
// Usado por mycroft-punter-analysis (pré-jogo) e futuramente pelo Trader (ao vivo)

const factorialCache: Record<number, number> = { 0: 1, 1: 1 }

function factorial(n: number): number {
  if (n in factorialCache) return factorialCache[n]
  factorialCache[n] = n * factorial(n - 1)
  return factorialCache[n]
}

export function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

export function buildScoreMatrix(
  lambdaCasa: number,
  lambdaVisitante: number,
  maxGols: number = 7
): number[][] {
  const matrix: number[][] = []
  for (let i = 0; i <= maxGols; i++) {
    matrix[i] = []
    for (let j = 0; j <= maxGols; j++) {
      matrix[i][j] = poissonProb(lambdaCasa, i) * poissonProb(lambdaVisitante, j)
    }
  }
  return matrix
}

export interface PoissonResult {
  probCasa: number
  probEmpate: number
  probVisitante: number
  probOver05: number
  probOver15: number
  probOver25: number
  probOver35: number
  probUnder25: number
  probUnder35: number
  probBTTS: number
  probNoBTTS: number
  placarMaisProvavel: string
  placarSegundoMaisProvavel: string
  lambdaCasa: number
  lambdaVisitante: number
  xGCombinado: number
}

export function calcularPoisson(
  mediaGolsCasa: number,
  mediaGolsVisitante: number,
  mediaGolsSofridosCasa: number,
  mediaGolsSofridosVisitante: number,
  fatorMandante: number = 1.1
): PoissonResult {
  const lambdaCasa = mediaGolsCasa * mediaGolsSofridosVisitante * fatorMandante
  const lambdaVisitante = mediaGolsVisitante * mediaGolsSofridosCasa

  const matrix = buildScoreMatrix(lambdaCasa, lambdaVisitante)

  let probCasa = 0, probEmpate = 0, probVisitante = 0
  let probOver05 = 0, probOver15 = 0, probOver25 = 0, probOver35 = 0
  let probBTTS = 0
  let maisProvavel = { prob: 0, placar: '1-0' }
  let segundoProvavel = { prob: 0, placar: '0-0' }

  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = matrix[i][j]
      const totalGols = i + j

      if (i > j) probCasa += p
      else if (i === j) probEmpate += p
      else probVisitante += p

      if (totalGols > 0.5) probOver05 += p
      if (totalGols > 1.5) probOver15 += p
      if (totalGols > 2.5) probOver25 += p
      if (totalGols > 3.5) probOver35 += p
      if (i > 0 && j > 0) probBTTS += p

      if (p > maisProvavel.prob) {
        segundoProvavel = { ...maisProvavel }
        maisProvavel = { prob: p, placar: `${i}-${j}` }
      } else if (p > segundoProvavel.prob) {
        segundoProvavel = { prob: p, placar: `${i}-${j}` }
      }
    }
  }

  return {
    probCasa: Math.round(probCasa * 1000) / 10,
    probEmpate: Math.round(probEmpate * 1000) / 10,
    probVisitante: Math.round(probVisitante * 1000) / 10,
    probOver05: Math.round(probOver05 * 1000) / 10,
    probOver15: Math.round(probOver15 * 1000) / 10,
    probOver25: Math.round(probOver25 * 1000) / 10,
    probOver35: Math.round(probOver35 * 1000) / 10,
    probUnder25: Math.round((1 - probOver25) * 1000) / 10,
    probUnder35: Math.round((1 - probOver35) * 1000) / 10,
    probBTTS: Math.round(probBTTS * 1000) / 10,
    probNoBTTS: Math.round((1 - probBTTS) * 1000) / 10,
    placarMaisProvavel: maisProvavel.placar,
    placarSegundoMaisProvavel: segundoProvavel.placar,
    lambdaCasa: Math.round(lambdaCasa * 100) / 100,
    lambdaVisitante: Math.round(lambdaVisitante * 100) / 100,
    xGCombinado: Math.round((lambdaCasa + lambdaVisitante) * 100) / 100,
  }
}

export interface EdgeResult {
  mercado: string
  probPoisson: number
  probImplicita: number
  edge: number
  temEdge: boolean
  oddJusta: number
}

export function calcularEdges(
  poisson: PoissonResult,
  odds: {
    casa?: number
    empate?: number
    visitante?: number
    over25?: number
    under25?: number
    over35?: number
    under35?: number
    over15?: number
    under15?: number
    btts?: number
    noBtts?: number
  }
): EdgeResult[] {
  const resultados: EdgeResult[] = []

  const mercados = [
    { nome: 'Casa', prob: poisson.probCasa, odd: odds.casa },
    { nome: 'Empate', prob: poisson.probEmpate, odd: odds.empate },
    { nome: 'Visitante', prob: poisson.probVisitante, odd: odds.visitante },
    { nome: 'Over 1.5', prob: poisson.probOver15, odd: odds.over15 },
    { nome: 'Under 1.5', prob: 100 - poisson.probOver15, odd: odds.under15 },
    { nome: 'Over 2.5', prob: poisson.probOver25, odd: odds.over25 },
    { nome: 'Under 2.5', prob: poisson.probUnder25, odd: odds.under25 },
    { nome: 'Over 3.5', prob: poisson.probOver35, odd: odds.over35 },
    { nome: 'Under 3.5', prob: poisson.probUnder35, odd: odds.under35 },
    { nome: 'BTTS', prob: poisson.probBTTS, odd: odds.btts },
    { nome: 'No BTTS', prob: poisson.probNoBTTS, odd: odds.noBtts },
  ]

  for (const m of mercados) {
    if (!m.odd || m.odd <= 1) continue

    const probImplicita = Math.round((1 / m.odd) * 1000) / 10
    const edge = Math.round((m.prob - probImplicita) * 10) / 10
    const oddJusta = Math.round((100 / m.prob) * 100) / 100

    resultados.push({
      mercado: m.nome,
      probPoisson: m.prob,
      probImplicita,
      edge,
      temEdge: edge >= 4,
      oddJusta,
    })
  }

  return resultados.sort((a, b) => b.edge - a.edge)
}

export function formatarBlocoPoisson(
  poisson: PoissonResult,
  edges: EdgeResult[],
  timeCasa: string,
  timeVisitante: string
): string {
  const edgesPositivos = edges.filter((e) => e.temEdge)
  const edgesNegativos = edges.filter((e) => !e.temEdge)

  return `
═══════════════════════════════════════
ANÁLISE QUANTITATIVA — POISSON BIVARIADA
═══════════════════════════════════════

Lambdas calculados:
  ${timeCasa}: λ = ${poisson.lambdaCasa} gols esperados
  ${timeVisitante}: λ = ${poisson.lambdaVisitante} gols esperados
  xG Combinado: ${poisson.xGCombinado}

Probabilidades calculadas matematicamente:
  Vitória ${timeCasa}: ${poisson.probCasa}%
  Empate: ${poisson.probEmpate}%
  Vitória ${timeVisitante}: ${poisson.probVisitante}%
  Over 1.5: ${poisson.probOver15}% | Under 1.5: ${(100 - poisson.probOver15).toFixed(1)}%
  Over 2.5: ${poisson.probOver25}% | Under 2.5: ${poisson.probUnder25}%
  Over 3.5: ${poisson.probOver35}% | Under 3.5: ${poisson.probUnder35}%
  BTTS: ${poisson.probBTTS}% | No BTTS: ${poisson.probNoBTTS}%

Placares mais prováveis:
  1º ${poisson.placarMaisProvavel} | 2º ${poisson.placarSegundoMaisProvavel}

EDGES CALCULADOS (Poisson vs Mercado):
${
  edgesPositivos.length > 0
    ? edgesPositivos
        .map(
          (e) =>
            `  ✅ ${e.mercado}: Poisson ${e.probPoisson}% vs Mercado ${e.probImplicita}% = EDGE +${e.edge}% | Odd justa: ${e.oddJusta}`
        )
        .join('\n')
    : '  Nenhum edge ≥ 4% identificado pelo modelo'
}

${edgesNegativos
  .map(
    (e) =>
      `  ❌ ${e.mercado}: Poisson ${e.probPoisson}% vs Mercado ${e.probImplicita}% = ${e.edge}%`
  )
  .join('\n')}

INSTRUÇÃO: Use estas probabilidades como BASE MATEMÁTICA da análise.
Ajuste apenas se houver informação contextual forte (lesão de titular,
motivação, condições climáticas, H2H recente) que justifique desvio.
Documente qualquer ajuste feito e o motivo.
`
}
