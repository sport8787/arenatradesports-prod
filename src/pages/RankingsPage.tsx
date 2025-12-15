import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users, Loader2 } from 'lucide-react';
import { useRankings } from '@/hooks/useRankings';
import LuxuryCard from '@/components/game/LuxuryCard';
import RankCard, { PlayerStatsCard } from '@/components/game/RankCard';
import GoldButton from '@/components/game/GoldButton';

export default function RankingsPage() {
  const { rankings, myRanking, loading } = useRankings();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const myPosition = myRanking 
    ? rankings.findIndex(r => r.id === myRanking.id) + 1 
    : null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>
            <h1 className="font-orbitron text-3xl font-bold text-primary flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              Ranking Global
            </h1>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span>{rankings.length} jogadores</span>
          </div>
        </div>

        {/* My Stats */}
        {myRanking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="font-orbitron text-lg text-muted-foreground mb-3">
              Suas Estatísticas
              {myPosition && (
                <span className="ml-2 text-primary">#{myPosition} no ranking</span>
              )}
            </h2>
            <PlayerStatsCard ranking={myRanking} />
          </motion.div>
        )}

        {/* Leaderboard */}
        <LuxuryCard className="p-6">
          <h2 className="font-orbitron text-xl mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Top Blefadores
          </h2>

          {rankings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum jogador no ranking ainda.
              </p>
              <Link to="/">
                <GoldButton>Seja o Primeiro!</GoldButton>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {rankings.map((ranking, index) => (
                <RankCard
                  key={ranking.id}
                  ranking={ranking}
                  position={index + 1}
                  isCurrentUser={myRanking?.id === ranking.id}
                />
              ))}
            </div>
          )}
        </LuxuryCard>
      </div>
    </div>
  );
}
