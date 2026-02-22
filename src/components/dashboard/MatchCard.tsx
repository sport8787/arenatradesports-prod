import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Loader2, AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Match {
  id: string;
  championship: string;
  championshipColor: 'yellow' | 'blue' | 'green' | 'red';
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  period: string;
  status: 'live' | 'scheduled' | 'finished';
  mycroftStatus: 'analyzing' | 'no_value' | 'opportunity' | 'APROVADO' | 'AGUARDAR' | 'VETADO';
}

const championshipColors: Record<string, string> = {
  yellow: 'bg-primary/20 text-primary border-primary/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-success/20 text-green-400 border-success/30',
  red: 'bg-destructive/20 text-red-400 border-destructive/30',
};

const isUrl = (s: string) => s.startsWith('http://') || s.startsWith('https://');

function TeamLogo({ logo, team }: { logo: string; team: string }) {
  const [imgError, setImgError] = useState(false);
  if (isUrl(logo) && !imgError) {
    return <img src={logo} alt={team} className="w-8 h-8 object-contain rounded-full" onError={() => setImgError(true)} />;
  }
  return <span className="text-2xl">{logo || '⚽'}</span>;
}

interface MatchCardProps {
  match: Match;
  index: number;
  onAnalysisClick?: (matchId: string) => void;
}

export default function MatchCard({ match, index, onAnalysisClick }: MatchCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.03 }}
      className="luxury-card group cursor-pointer"
    >
      <div className="p-5 space-y-4">
        {/* Header: Championship + Live Badge */}
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-[11px] font-orbitron uppercase tracking-wider px-2.5 py-1 rounded-full border',
            championshipColors[match.championshipColor]
          )}>
            {match.championship}
          </span>
          {match.status === 'live' && (
            <span className="flex items-center gap-1.5 text-[11px] font-orbitron uppercase tracking-wider text-destructive">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              Ao Vivo
            </span>
          )}
          {match.status === 'scheduled' && (
            <span className="text-[11px] font-orbitron uppercase tracking-wider text-muted-foreground">
              Pré-Live
            </span>
          )}
          {match.status === 'finished' && (
            <span className="text-[11px] font-orbitron uppercase tracking-wider text-muted-foreground">
              Finalizado
            </span>
          )}
        </div>

        {/* Teams + Score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <TeamLogo logo={match.homeLogo} team={match.home} />
            <span className="text-sm font-semibold text-foreground truncate max-w-full">{match.home}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-4xl md:text-5xl font-orbitron font-bold text-foreground">{match.scoreHome}</span>
            <span className="text-lg text-muted-foreground font-orbitron">-</span>
            <span className="text-4xl md:text-5xl font-orbitron font-bold text-foreground">{match.scoreAway}</span>
          </div>

          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <TeamLogo logo={match.awayLogo} team={match.away} />
            <span className="text-sm font-semibold text-foreground truncate max-w-full">{match.away}</span>
          </div>
        </div>

        {/* Minute */}
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
          <Clock className="w-3.5 h-3.5" />
          <span>⏱️ {match.minute}' | {match.period}</span>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Mycroft Status */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-orbitron uppercase tracking-wider">🤖 Status Mycroft</span>

          {(match.mycroftStatus === 'analyzing' || match.mycroftStatus === 'AGUARDAR') && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
              <Loader2 className="w-4 h-4 text-warning animate-spin" />
              <span className="text-sm text-warning font-medium uppercase font-orbitron">AGUARDAR...</span>
            </div>
          )}

          {(match.mycroftStatus === 'no_value' || match.mycroftStatus === 'VETADO') && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium uppercase font-orbitron">VETADO</span>
            </div>
          )}

          {(match.mycroftStatus === 'opportunity' || match.mycroftStatus === 'APROVADO') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
                <Target className="w-4 h-4 text-success" />
                <span className="text-sm text-success font-bold uppercase font-orbitron">APROVADO</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAnalysisClick?.(match.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-success-foreground font-orbitron font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                Ver Análise Completa
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
