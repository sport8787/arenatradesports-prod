export interface AssetScore {
  edge_score: number;
  confidence_score: number;
  tier_score: number;
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
}): AssetScore {
  const edge = prediction.value_percentage || 0;
  const confidence = prediction.confidence || 50;

  // Edge Score (40%) — edge 2% = 50pts, 10%+ = 100pts
  const edgeScore = Math.min(100, (edge / 10) * 100);

  // Confidence Score (30%) — directly from AI confidence
  const confidenceScore = Math.min(100, confidence);

  // Tier Score (20%) — based on odd range
  const odd = prediction.odd || 2;
  const tierScore = odd <= 1.8 ? 100 : odd <= 2.5 ? 75 : 50;

  // Liquidity Score (10%) — based on bookmaker quality
  const topBooks = ['pinnacle', 'bet365', 'betfair'];
  const liquidityScore = topBooks.includes((prediction.bookmaker || '').toLowerCase()) ? 90 : 60;

  const finalScore = Math.round(
    edgeScore * 0.40 +
    confidenceScore * 0.30 +
    tierScore * 0.20 +
    liquidityScore * 0.10
  );

  let classification: AssetScore['classification'];
  if (finalScore >= 90) classification = 'Elite';
  else if (finalScore >= 80) classification = 'Premium';
  else if (finalScore >= 70) classification = 'Strong';
  else if (finalScore >= 60) classification = 'Moderate';
  else classification = 'Avoid';

  return {
    edge_score: Math.round(edgeScore),
    confidence_score: Math.round(confidenceScore),
    tier_score: tierScore,
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
