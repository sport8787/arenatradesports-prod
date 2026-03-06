export interface AssetScore {
  probability_score: number;
  edge_score: number;
  stats_score: number;
  pattern_score: number;
  liquidity_score: number;
  final_score: number;
  classification: 'Elite' | 'Premium' | 'Strong' | 'Moderate' | 'Avoid';
  expected_roi: number;
}

export function calculateAssetScore(prediction: {
  value_percentage?: number;
  confidence?: number;
  odd?: number;
  bookmaker?: string;
  estimated_probability?: number;
  stats_strength?: number;    // 0-100 from analysis
  pattern_confidence?: number; // 0-100 from pattern mining
}): AssetScore {
  const edge = prediction.value_percentage || 0;
  const confidence = prediction.confidence || 50;
  const odd = prediction.odd || 2;

  // 1️⃣ Probability Score (25%) — AI confidence mapped to score
  const probabilityScore = Math.min(100, confidence);

  // 2️⃣ Market Edge Score (25%) — edge 2% = 40pts, 5% = 70pts, 10%+ = 100pts
  const edgeScore = Math.min(100, (edge / 10) * 100);

  // 3️⃣ Statistical Strength (20%) — from analysis data or estimated from odd range
  const statsStrength = prediction.stats_strength
    ?? (odd <= 1.5 ? 85 : odd <= 2.0 ? 70 : odd <= 2.5 ? 60 : odd <= 3.0 ? 50 : 40);
  const statsScore = Math.min(100, statsStrength);

  // 4️⃣ Pattern Confidence (15%) — from pattern mining or base 50
  const patternConfidence = prediction.pattern_confidence ?? 50;
  const patternScore = Math.min(100, patternConfidence);

  // 5️⃣ Market Stability / Liquidity (15%) — bookmaker quality + odd stability
  const topBooks = ['pinnacle', 'bet365', 'betfair'];
  const liquidityScore = topBooks.includes((prediction.bookmaker || '').toLowerCase()) ? 90 : 60;

  const finalScore = Math.round(
    probabilityScore * 0.25 +
    edgeScore * 0.25 +
    statsScore * 0.20 +
    patternScore * 0.15 +
    liquidityScore * 0.15
  );

  let classification: AssetScore['classification'];
  if (finalScore >= 90) classification = 'Elite';
  else if (finalScore >= 80) classification = 'Premium';
  else if (finalScore >= 70) classification = 'Strong';
  else if (finalScore >= 60) classification = 'Moderate';
  else classification = 'Avoid';

  return {
    probability_score: Math.round(probabilityScore),
    edge_score: Math.round(edgeScore),
    stats_score: Math.round(statsScore),
    pattern_score: Math.round(patternScore),
    liquidity_score: liquidityScore,
    final_score: finalScore,
    classification,
    expected_roi: edge,
  };
}

export function getClassificationColor(classification: AssetScore['classification']) {
  switch (classification) {
    case 'Elite': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
    case 'Premium': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    case 'Strong': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    case 'Moderate': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    case 'Avoid': return { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/30' };
  }
}
