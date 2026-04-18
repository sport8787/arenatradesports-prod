import { motion } from 'framer-motion';
import { Clock, Calendar, Trophy, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduledGame } from '@/hooks/useScheduledGames';

interface ScheduledGamesSectionProps {
  games: ScheduledGame[];
  loading: boolean;
  mode?: 'upcoming' | 'prelive';
}

const statusLabels: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'text-muted-foreground border-border bg-secondary/30' },
  checking: { label: 'Checando', className: 'text-warning border-warning/30 bg-warning/10' },
  live: { label: 'Ao Vivo', className: 'text-destructive border-destructive/30 bg-destructive/10' },
  analyzed: { label: 'Analisado', className: 'text-success border-success/30 bg-success/10' },
  finished: { label: 'Finalizado', className: 'text-muted-foreground border-border bg-muted/30' },
};

function formatTime(matchDatetime: string) {
  const d = new Date(matchDatetime);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function timeUntil(matchDatetime: string) {
  const diff = new Date(matchDatetime).getTime() - Date.now();
  if (diff <= 0) return 'Agora';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `em ${hours}h${mins > 0 ? `${mins}min` : ''}`;
  return `em ${mins}min`;
}

export default function ScheduledGamesSection({ games, loading }: ScheduledGamesSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="font-orbitron text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Próximos Jogos do Dia
        </h2>
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">Carregando agenda...</span>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-orbitron text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Próximos Jogos do Dia
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <span className="text-4xl">📅</span>
          <p className="text-sm text-muted-foreground">Nenhum jogo programado para hoje</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-orbitron text-sm font-bold text-foreground flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        Próximos Jogos do Dia
        <span className="text-xs text-muted-foreground font-normal ml-auto">{games.length} jogos</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {games.map((game, i) => {
          const status = statusLabels[game.status || 'scheduled'] || statusLabels.scheduled;
          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="luxury-card p-4 space-y-3"
            >
              {/* League + Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-[10px] font-orbitron uppercase tracking-wider text-primary truncate">
                    {game.league_name}
                  </span>
                </div>
                <span className={cn(
                  'text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full border shrink-0',
                  status.className
                )}>
                  {status.label}
                </span>
              </div>

              {/* Teams */}
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground truncate">{game.home_team}</p>
                <span className="text-xs text-muted-foreground">vs</span>
                <p className="text-sm font-semibold text-foreground truncate">{game.away_team}</p>
              </div>

              {/* Time */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(game.match_datetime)}</span>
                </div>
                <span className="font-orbitron text-primary font-medium">
                  {timeUntil(game.match_datetime)}
                </span>
              </div>

              {/* Relevance */}
              {(game.relevance_score ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(game.relevance_score ?? 0, 5) }).map((_, j) => (
                    <span key={j} className="text-primary text-[10px]">⭐</span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
