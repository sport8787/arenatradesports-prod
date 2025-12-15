import { motion } from 'framer-motion';
import { Trophy, Target, Brain, TrendingUp, Medal } from 'lucide-react';
import { Ranking, calculateRankingStats, getRankTier } from '@/types/ranking';
import { cn } from '@/lib/utils';
import LuxuryCard from './LuxuryCard';

interface RankCardProps {
  ranking: Ranking;
  position: number;
  isCurrentUser?: boolean;
}

export default function RankCard({ ranking, position, isCurrentUser }: RankCardProps) {
  const stats = calculateRankingStats(ranking);
  const tier = getRankTier(ranking.total_points);

  const getMedalColor = (pos: number) => {
    if (pos === 1) return 'text-yellow-400';
    if (pos === 2) return 'text-gray-300';
    if (pos === 3) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.05 }}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl transition-all',
        isCurrentUser 
          ? 'bg-primary/10 border-2 border-primary' 
          : 'bg-card/50 border border-border hover:border-primary/30'
      )}
    >
      {/* Position */}
      <div className="flex-shrink-0 w-12 text-center">
        {position <= 3 ? (
          <Medal className={cn('w-8 h-8 mx-auto', getMedalColor(position))} />
        ) : (
          <span className="font-orbitron text-xl text-muted-foreground">
            {position}º
          </span>
        )}
      </div>

      {/* Avatar & Tier */}
      <div className="flex-shrink-0">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br',
          tier.color
        )}>
          {tier.icon}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-orbitron font-bold truncate">
            {ranking.nickname}
          </span>
          {isCurrentUser && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Você
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-wider">{tier.tier}</span>
          <span>•</span>
          <span>{ranking.total_games} jogos</span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Vitórias</div>
          <div className="font-orbitron font-bold text-success">{stats.winRate}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Blefes</div>
          <div className="font-orbitron font-bold text-warning">{stats.bluffSuccessRate}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Detecção</div>
          <div className="font-orbitron font-bold text-mycroft-cyan">{stats.detectionRate}%</div>
        </div>
      </div>

      {/* Points */}
      <div className="flex-shrink-0 text-right">
        <div className="font-orbitron text-2xl font-bold text-primary">
          {ranking.total_points.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground uppercase">pontos</div>
      </div>
    </motion.div>
  );
}

interface PlayerStatsCardProps {
  ranking: Ranking;
}

export function PlayerStatsCard({ ranking }: PlayerStatsCardProps) {
  const stats = calculateRankingStats(ranking);
  const tier = getRankTier(ranking.total_points);

  return (
    <LuxuryCard className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-gradient-to-br',
          tier.color
        )}>
          {tier.icon}
        </div>
        <div>
          <h3 className="font-orbitron text-xl font-bold">{ranking.nickname}</h3>
          <p className="text-muted-foreground">{tier.tier}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="font-orbitron text-3xl font-bold text-primary">
            {ranking.total_points.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">pontos totais</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          icon={<Trophy className="w-5 h-5" />}
          label="Vitórias"
          value={ranking.total_wins}
          subtext={`${stats.winRate}% taxa`}
          color="text-success"
        />
        <StatBox
          icon={<Brain className="w-5 h-5" />}
          label="Blefes"
          value={ranking.successful_bluffs}
          subtext={`${stats.bluffSuccessRate}% sucesso`}
          color="text-warning"
        />
        <StatBox
          icon={<Target className="w-5 h-5" />}
          label="Detectados"
          value={ranking.bluffs_detected}
          subtext={`${stats.detectionRate}% precisão`}
          color="text-mycroft-cyan"
        />
        <StatBox
          icon={<TrendingUp className="w-5 h-5" />}
          label="Jogos"
          value={ranking.total_games}
          subtext={`${stats.averagePoints} pts/jogo`}
          color="text-primary"
        />
      </div>
    </LuxuryCard>
  );
}

function StatBox({ 
  icon, 
  label, 
  value, 
  subtext, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  subtext: string; 
  color: string;
}) {
  return (
    <div className="bg-secondary/50 rounded-lg p-4 text-center">
      <div className={cn('flex justify-center mb-2', color)}>{icon}</div>
      <div className="font-orbitron text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-xs mt-1', color)}>{subtext}</div>
    </div>
  );
}
