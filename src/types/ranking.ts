export interface Ranking {
  id: string;
  nickname: string;
  session_id: string;
  total_games: number;
  total_wins: number;
  total_points: number;
  successful_bluffs: number;
  bluffs_detected: number;
  times_fooled: number;
  created_at: string;
  updated_at: string;
}

export interface RankingStats {
  winRate: number;
  bluffSuccessRate: number;
  detectionRate: number;
  averagePoints: number;
}

export function calculateRankingStats(ranking: Ranking): RankingStats {
  const winRate = ranking.total_games > 0 
    ? Math.round((ranking.total_wins / ranking.total_games) * 100) 
    : 0;
  
  const totalBluffAttempts = ranking.successful_bluffs + ranking.bluffs_detected;
  const bluffSuccessRate = totalBluffAttempts > 0 
    ? Math.round((ranking.successful_bluffs / totalBluffAttempts) * 100) 
    : 0;

  const totalDetectionAttempts = ranking.bluffs_detected + ranking.times_fooled;
  const detectionRate = totalDetectionAttempts > 0 
    ? Math.round((ranking.bluffs_detected / totalDetectionAttempts) * 100) 
    : 0;

  const averagePoints = ranking.total_games > 0 
    ? Math.round(ranking.total_points / ranking.total_games) 
    : 0;

  return { winRate, bluffSuccessRate, detectionRate, averagePoints };
}

export function getRankTier(totalPoints: number): { tier: string; color: string; icon: string } {
  if (totalPoints >= 10000) return { tier: 'Lendário', color: 'from-amber-400 to-yellow-600', icon: '👑' };
  if (totalPoints >= 5000) return { tier: 'Diamante', color: 'from-cyan-400 to-blue-600', icon: '💎' };
  if (totalPoints >= 2500) return { tier: 'Platina', color: 'from-slate-300 to-slate-500', icon: '⚡' };
  if (totalPoints >= 1000) return { tier: 'Ouro', color: 'from-yellow-500 to-amber-600', icon: '🏆' };
  if (totalPoints >= 500) return { tier: 'Prata', color: 'from-gray-300 to-gray-500', icon: '🥈' };
  if (totalPoints >= 100) return { tier: 'Bronze', color: 'from-orange-600 to-amber-800', icon: '🥉' };
  return { tier: 'Novato', color: 'from-stone-500 to-stone-700', icon: '🎲' };
}
