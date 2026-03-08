export interface AssetScore {
  probability_score: number;
  edge_score: number;
  stats_score: number;
  pattern_score: number;
  liquidity_score: number;
  final_score: number;
  grade: 'A+' | 'A' | 'B' | 'C';
  classification: 'Elite' | 'Premium' | 'Strong' | 'Moderate' | 'Avoid';
  expected_roi: number;
  implied_probability: number;
  model_probability: number;
}

export function calculateAssetScore(prediction: {
  value_percentage?: number;
  confidence?: number;
  odd?: number;
  bookmaker?: string;
  estimated_probability?: number;
  stats_strength?: number;
  pattern_confidence?: number;
}): AssetScore {
  const edge = prediction.value_percentage || 0;
  const confidence = prediction.confidence || 50;
  const odd = prediction.odd || 2;

  const probabilityScore = Math.min(100, confidence);
  // Edge scale: 0%=0, 5%=50, 10%=75, 15%=90, 20%+=100
  const edgeScore = Math.min(100, Math.round((1 - Math.exp(-edge / 8)) * 100));

  const statsStrength = prediction.stats_strength
    ?? (odd <= 1.5 ? 85 : odd <= 2.0 ? 70 : odd <= 2.5 ? 60 : odd <= 3.0 ? 50 : 40);
  const statsScore = Math.min(100, statsStrength);

  const patternConfidence = prediction.pattern_confidence ?? 50;
  const patternScore = Math.min(100, patternConfidence);

  const topBooks = ['pinnacle', 'bet365', 'betfair'];
  const liquidityScore = topBooks.includes((prediction.bookmaker || '').toLowerCase()) ? 90 : 60;

  const finalScore = Math.round(
    probabilityScore * 0.25 +
    edgeScore * 0.25 +
    statsScore * 0.20 +
    patternScore * 0.15 +
    liquidityScore * 0.15
  );

  // Grade system: A+ (80-100), A (70-79), B (60-69), C (50-59)
  let grade: AssetScore['grade'];
  if (finalScore >= 80) grade = 'A+';
  else if (finalScore >= 70) grade = 'A';
  else if (finalScore >= 60) grade = 'B';
  else grade = 'C';

  let classification: AssetScore['classification'];
  if (finalScore >= 90) classification = 'Elite';
  else if (finalScore >= 80) classification = 'Premium';
  else if (finalScore >= 70) classification = 'Strong';
  else if (finalScore >= 60) classification = 'Moderate';
  else classification = 'Avoid';

  const impliedProb = odd > 0 ? (1 / odd) * 100 : 0;
  const modelProb = prediction.estimated_probability ?? confidence;

  return {
    probability_score: Math.round(probabilityScore),
    edge_score: Math.round(edgeScore),
    stats_score: Math.round(statsScore),
    pattern_score: Math.round(patternScore),
    liquidity_score: liquidityScore,
    final_score: finalScore,
    grade,
    classification,
    expected_roi: edge,
    implied_probability: Math.round(impliedProb * 10) / 10,
    model_probability: Math.round(modelProb * 10) / 10,
  };
}

export function getGradeConfig(grade: AssetScore['grade']) {
  switch (grade) {
    case 'A+': return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30', emoji: '🟢', label: 'Oportunidade premium. Aposta forte' };
    case 'A': return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30', emoji: '🟢', label: 'Boa oportunidade' };
    case 'B': return { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', emoji: '🟡', label: 'Aposta aceitável' };
    case 'C': return { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/30', emoji: '⚪', label: 'Neutra' };
  }
}

export function getClassificationColor(classification: AssetScore['classification']) {
  switch (classification) {
    case 'Elite': return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' };
    case 'Premium': return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    case 'Strong': return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' };
    case 'Moderate': return { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' };
    case 'Avoid': return { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/30' };
  }
}
