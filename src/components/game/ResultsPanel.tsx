import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Coins, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Player, Vote, Question } from '@/types/game';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { getAvatarColor, getInitials } from '@/lib/gameUtils';

// Reward constants (same as GameRoom)
const HOST_CORRECT_ANSWER = 100;
const HOST_WRONG_PARTIAL_BLUFF = 200;
const HOST_WRONG_FULL_BLUFF = 300;
const JURY_CORRECT_READING = 50;

interface ResultsPanelProps {
  question: Question;
  currentPlayer: Player;
  players: Player[];
  votes: Vote[];
  wasBluffSuccessful: boolean;
  confirmedAnswer?: 'A' | 'B' | 'C' | 'D' | null;
  onCoinSound?: () => void;
  showCoinAnimation?: boolean;
}

interface PlayerReward {
  player: Player;
  reward: number;
  reason: string;
  isHost: boolean;
  voteType?: 'believe' | 'doubt';
}

interface CoinAnimation {
  id: string;
  targetIndex: number;
  delay: number;
}

export default function ResultsPanel({
  question,
  currentPlayer,
  players,
  votes,
  wasBluffSuccessful,
  confirmedAnswer,
  onCoinSound,
  showCoinAnimation = true,
}: ResultsPanelProps) {
  const [showCoins, setShowCoins] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [coinAnimations, setCoinAnimations] = useState<CoinAnimation[]>([]);
  const playedSoundsRef = useRef<Set<number>>(new Set());
  const rewardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);


  const correctOption = question.correct_option;
  const correctText = question[`option_${correctOption.toLowerCase()}` as keyof Question] as string;
  const playerGotCorrect = confirmedAnswer === correctOption;

  const believers = votes.filter(v => v.vote_type === 'believe');
  const doubters = votes.filter(v => v.vote_type === 'doubt');
  const totalJuryVotes = votes.length;

  // Calculate rewards for each player
  const calculateRewards = (): PlayerReward[] => {
    const rewards: PlayerReward[] = [];

    // Host reward
    let hostReward = 0;
    let hostReason = '';

    if (playerGotCorrect) {
      hostReward = HOST_CORRECT_ANSWER;
      hostReason = 'Resposta correta';
    } else if (believers.length > 0) {
      if (believers.length === totalJuryVotes && totalJuryVotes > 0) {
        hostReward = HOST_WRONG_FULL_BLUFF;
        hostReason = 'Blefe perfeito!';
      } else {
        hostReward = HOST_WRONG_PARTIAL_BLUFF;
        hostReason = 'Blefe parcial';
      }
    } else {
      hostReason = 'Blefe descoberto';
    }

    rewards.push({
      player: currentPlayer,
      reward: hostReward,
      reason: hostReason,
      isHost: true,
    });

    // Jury rewards
    votes.forEach((vote) => {
      const player = players.find(p => p.id === vote.player_id);
      if (!player || player.id === currentPlayer.id) return;

      const correctReading = 
        (!playerGotCorrect && vote.vote_type === 'doubt') || 
        (playerGotCorrect && vote.vote_type === 'believe');

      rewards.push({
        player,
        reward: correctReading ? JURY_CORRECT_READING : 0,
        reason: correctReading ? 'Leitura correta' : 'Leitura errada',
        isHost: false,
        voteType: vote.vote_type as 'believe' | 'doubt',
      });
    });

    return rewards;
  };

  const rewards = calculateRewards();

  useEffect(() => {
    const timer1 = setTimeout(() => setShowCoins(true), 500);
    const timer2 = setTimeout(() => setShowRewards(true), 1200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Trigger coin animations when rewards are shown
  useEffect(() => {
    if (!showRewards) return;
    
    const animations: CoinAnimation[] = [];
    
    rewards.forEach((item, index) => {
      if (item.reward > 0) {
        // Create multiple coins per player based on reward amount
        const coinCount = Math.min(Math.ceil(item.reward / 50), 5);
        for (let i = 0; i < coinCount; i++) {
          animations.push({
            id: `${item.player.id}-${i}`,
            targetIndex: index,
            delay: index * 0.15 + i * 0.08,
          });
        }
      }
    });
    
    setCoinAnimations(animations);
  }, [showRewards, rewards.length]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 relative"
    >
      {/* Falling Coins Animation */}
      {showCoins && showCoinAnimation && (
        <div className="coins-container">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: Math.random() * window.innerWidth, y: -50, rotate: 0 }}
              animate={{ y: window.innerHeight + 100, rotate: 720 }}
              transition={{ duration: 2 + Math.random(), delay: i * 0.1, ease: 'easeIn' }}
              className="absolute text-primary"
            >
              <Coins className="w-8 h-8" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Coins flying to players animation */}
      <AnimatePresence>
        {showCoinAnimation && coinAnimations.map((coin) => {
          const targetRef = rewardRefs.current[coin.targetIndex];
          const containerRect = containerRef.current?.getBoundingClientRect();
          
          if (!targetRef || !containerRect) return null;
          
          const targetRect = targetRef.getBoundingClientRect();
          const targetX = targetRect.left - containerRect.left + 20;
          const targetY = targetRect.top - containerRect.top + 20;
          const startX = containerRect.width / 2;
          const startY = 100;
          
          return (
            <motion.div
              key={coin.id}
              initial={{ 
                x: startX, 
                y: startY, 
                scale: 1.5, 
                opacity: 1,
              }}
              animate={{ 
                x: targetX, 
                y: targetY, 
                scale: 0.5, 
                opacity: 0,
              }}
              transition={{ 
                duration: 0.8, 
                delay: coin.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              onAnimationComplete={() => {
                // Play sound only once per player (first coin to arrive)
                if (!playedSoundsRef.current.has(coin.targetIndex)) {
                  playedSoundsRef.current.add(coin.targetIndex);
                  onCoinSound?.();
                }
              }}
              className="absolute pointer-events-none z-50"
            >
              <div className="relative">
                <Coins className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-primary/30"
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Correct Answer Reveal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-4"
      >
        <h3 className="font-orbitron text-2xl text-foreground">
          Resposta Correta
        </h3>
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-success/20 border border-success/50">
          <span className="w-10 h-10 rounded-full bg-success flex items-center justify-center font-orbitron font-bold">
            {correctOption}
          </span>
          <span className="text-xl font-medium text-success-foreground">{correctText}</span>
        </div>
      </motion.div>

      {/* Bluff Result */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'text-center p-6 rounded-xl border-2',
          wasBluffSuccessful 
            ? 'bg-primary/10 border-primary/50' 
            : 'bg-destructive/10 border-destructive/50'
        )}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          {wasBluffSuccessful ? (
            <Check className="w-8 h-8 text-primary" />
          ) : (
            <X className="w-8 h-8 text-destructive" />
          )}
          <h4 className="font-orbitron text-xl">
            {wasBluffSuccessful ? 'Blefe Bem-Sucedido!' : 'Blefe Descoberto!'}
          </h4>
        </div>
        <p className="text-muted-foreground">
          {wasBluffSuccessful 
            ? `${currentPlayer.nickname} enganou ${believers.length} jogador(es)!`
            : `${doubters.length} jogador(es) descobriram a mentira!`
          }
        </p>
      </motion.div>

      {/* Vote Summary */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="luxury-card p-4 text-center">
          <div className="text-3xl font-orbitron font-bold text-success mb-1">
            {believers.length}
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            Acreditaram
          </div>
        </div>
        <div className="luxury-card p-4 text-center">
          <div className="text-3xl font-orbitron font-bold text-destructive mb-1">
            {doubters.length}
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            Duvidaram
          </div>
        </div>
      </motion.div>

      {/* Rewards Breakdown */}
      {showRewards && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-primary" />
            <h4 className="font-orbitron text-lg text-primary uppercase tracking-wider">
              Recompensas
            </h4>
          </div>

          <div className="space-y-2">
            {rewards.map((item, index) => {
              const playerIndex = players.findIndex(p => p.id === item.player.id);
              return (
                <motion.div
                  key={item.player.id}
                  ref={(el) => { rewardRefs.current[index] = el; }}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg relative overflow-hidden',
                    item.isHost ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/50',
                    item.reward > 0 && 'ring-1 ring-primary/20'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br shrink-0',
                      getAvatarColor(playerIndex >= 0 ? playerIndex : 0)
                    )}
                  >
                    {getInitials(item.player.nickname)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.player.nickname}</span>
                      {item.isHost && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-orbitron">
                          HOST
                        </span>
                      )}
                      {item.voteType && (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded font-medium',
                          item.voteType === 'believe' 
                            ? 'bg-success/20 text-success' 
                            : 'bg-destructive/20 text-destructive'
                        )}>
                          {item.voteType === 'believe' ? 'CLARO' : 'BLEFE'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{item.reason}</span>
                  </div>

                  {/* Reward */}
                  <div className={cn(
                    'flex items-center gap-1 font-orbitron font-bold',
                    item.reward > 0 ? 'text-success' : item.reward < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {item.reward > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : item.reward < 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                    <span>{item.reward > 0 ? `+${item.reward}` : item.reward}</span>
                    <Coins className="w-4 h-4 text-primary" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}