import { motion } from 'framer-motion';
import { Loader2, ScanEye } from 'lucide-react';
import { cn } from '@/lib/utils';
import DynamicCountdown from './DynamicCountdown';
import { useNarrativeOptional } from '@/contexts/NarrativeContext';
import { BluffCoinCost } from './BluffCoinDisplay';
import cartaClaro from '@/assets/carta_claro.png';
import cartaBlefe from '@/assets/carta_blefe.png';

interface VotingPanelProps {
  onVote: (vote: 'believe' | 'doubt') => void;
  hasVoted: boolean;
  votedFor?: 'believe' | 'doubt';
  disabled?: boolean;
  onTimerComplete?: () => void;
  onTimerTick?: (secondsLeft: number) => void;
  timerActive?: boolean;
  doubtCost?: number;
  canAffordDoubt?: boolean;
  onDetectorClick?: () => void;
  detectorCost?: number;
  canAffordDetector?: boolean;
  hasUsedDetector?: boolean;
  /** Override timer duration (e.g., 180s for video evidence) */
  timerDurationOverride?: number;
}

export default function VotingPanel({ 
  onVote, 
  hasVoted, 
  votedFor, 
  disabled,
  onTimerComplete,
  onTimerTick,
  timerActive = true,
  doubtCost = 0,
  canAffordDoubt = true,
  onDetectorClick,
  detectorCost = 150,
  canAffordDetector = true,
  hasUsedDetector = false,
  timerDurationOverride,
}: VotingPanelProps) {
  const canDoubt = canAffordDoubt && !hasVoted && !disabled;
  const canUseDetector = canAffordDetector && !hasUsedDetector && !hasVoted && !disabled;
  
  // Get narrative context for dynamic timer (optional - works without it)
  const narrative = useNarrativeOptional();
  // Use override if provided (e.g., 180s for video evidence), otherwise use narrative or default
  const timerDuration = timerDurationOverride ?? narrative?.timerDuration ?? 60;
  const timerVisible = narrative?.timerVisible ?? true;
  const pressureLevel = narrative?.pressureLevel ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      {/* Dynamic Timer - adapts to narrative act */}
      <div className="flex justify-center">
        <DynamicCountdown
          duration={timerDuration}
          visible={timerVisible}
          pressureLevel={pressureLevel}
          isActive={timerActive && !hasVoted}
          onComplete={() => onTimerComplete?.()}
          onTick={onTimerTick}
        />
      </div>

      <div className="text-center">
        <h3 className="font-orbitron text-xl text-foreground mb-2">
          O Veredito
        </h3>
        <p className="text-muted-foreground">
          {hasVoted ? 'Aguardando outros jogadores...' : 'Escolha sua carta'}
        </p>
      </div>

      {/* Detector Button - CONSULTAR MYCROFT */}
      {onDetectorClick && (
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: canUseDetector ? 1.05 : 1 }}
            whileTap={{ scale: canUseDetector ? 0.95 : 1 }}
            onClick={onDetectorClick}
            disabled={!canUseDetector}
            className={cn(
              'flex items-center gap-3 px-6 py-3 rounded-xl font-orbitron text-sm uppercase tracking-wider transition-all border-2',
              canUseDetector
                ? 'bg-gradient-to-r from-emerald-900/60 via-cyan-900/60 to-emerald-900/60 border-emerald-400/70 text-emerald-300 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/30 animate-pulse'
                : 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed',
              hasUsedDetector && 'opacity-50 animate-none'
            )}
          >
            <ScanEye className="w-5 h-5" />
            <span>{hasUsedDetector ? 'Mycroft Consultado' : 'CONSULTAR MYCROFT'}</span>
            {!hasUsedDetector && <BluffCoinCost amount={detectorCost} className="text-sm" />}
          </motion.button>
        </div>
      )}

      <div className="flex gap-6 justify-center">
        {/* Carta CLARO (Acreditar) */}
        <motion.button
          whileHover={{ scale: hasVoted ? 1 : 1.05, y: hasVoted ? 0 : -10 }}
          whileTap={{ scale: hasVoted ? 1 : 0.95 }}
          onClick={() => !hasVoted && !disabled && onVote('believe')}
          disabled={hasVoted || disabled}
          className={cn(
            'relative transition-all duration-300',
            hasVoted && votedFor !== 'believe' && 'opacity-30 scale-90',
            hasVoted && votedFor === 'believe' && 'ring-4 ring-success ring-offset-4 ring-offset-background rounded-2xl'
          )}
        >
          <img 
            src={cartaClaro} 
            alt="CLARO - Acreditar" 
            className="w-32 h-48 object-cover rounded-xl shadow-lg"
          />
          {hasVoted && votedFor === 'believe' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-success" />
            </div>
          )}
          <p className="text-xs text-center mt-2 text-muted-foreground">Grátis</p>
        </motion.button>

        {/* Carta BLEFE (Duvidar) */}
        <motion.button
          whileHover={{ scale: hasVoted || !canAffordDoubt ? 1 : 1.05, y: hasVoted || !canAffordDoubt ? 0 : -10 }}
          whileTap={{ scale: hasVoted || !canAffordDoubt ? 1 : 0.95 }}
          onClick={() => canDoubt && onVote('doubt')}
          disabled={hasVoted || disabled || !canAffordDoubt}
          className={cn(
            'relative transition-all duration-300',
            hasVoted && votedFor !== 'doubt' && 'opacity-30 scale-90',
            hasVoted && votedFor === 'doubt' && 'ring-4 ring-destructive ring-offset-4 ring-offset-background rounded-2xl',
            !canAffordDoubt && !hasVoted && 'opacity-50 cursor-not-allowed grayscale'
          )}
        >
          <img 
            src={cartaBlefe} 
            alt="BLEFE - Duvidar" 
            className="w-32 h-48 object-cover rounded-xl shadow-lg"
          />
          {hasVoted && votedFor === 'doubt' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-destructive" />
            </div>
          )}
          {doubtCost > 0 && (
            <div className="text-center mt-2">
              <BluffCoinCost amount={doubtCost} className={cn('text-xs', !canAffordDoubt && 'text-destructive')} />
            </div>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
