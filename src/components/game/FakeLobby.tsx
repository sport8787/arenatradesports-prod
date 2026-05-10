import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHADOW_PLAYER_NAMES, SHADOW_PLAYER_AVATARS, ShadowPlayer, generateShadowPlayers } from '@/types/bot';
import { GamePhaseConfig } from '@/hooks/useEconomy';

interface FakeLobbyProps {
  playerName: string;
  onComplete: (shadowPlayers: ShadowPlayer[]) => void;
  duration?: number;
  phaseConfig?: GamePhaseConfig;
}

export function FakeLobby({ playerName, onComplete, duration = 5000, phaseConfig }: FakeLobbyProps) {
  const [players, setPlayers] = useState<{ id: string; name: string; avatar: string; isPlayer: boolean }[]>([
    { id: 'player', name: playerName, avatar: '🎮', isPlayer: true }
  ]);
  const [status, setStatus] = useState('Procurando jogadores...');
  const [progress, setProgress] = useState(0);
  const [shadowPlayers, setShadowPlayers] = useState<ShadowPlayer[]>([]);

  useEffect(() => {
    // Generate 3 random shadow players
    const generated = generateShadowPlayers(3);
    setShadowPlayers(generated);

    // Add shadow players progressively (simulating real matchmaking)
    const playersToAdd = generated.map((sp, i) => ({
      id: sp.id,
      name: sp.nickname,
      avatar: sp.avatar,
      isPlayer: false,
    }));

    const intervals: NodeJS.Timeout[] = [];

    // Stagger the additions with random delays for realism
    playersToAdd.forEach((player, index) => {
      const baseDelay = (duration / 4) * (index + 1);
      const randomOffset = Math.random() * 500 - 250; // +/- 250ms
      const delay = Math.max(500, baseDelay + randomOffset);
      
      const timeout = setTimeout(() => {
        setPlayers(prev => [...prev, player]);
        setStatus(index < 2 ? `${player.name} entrou na sala!` : 'Mesa completa!');
      }, delay);
      intervals.push(timeout);
    });

    // Progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 100));
    }, duration / 50);

    // Complete after duration
    const completeTimeout = setTimeout(() => {
      onComplete(generated);
    }, duration);

    return () => {
      intervals.forEach(clearTimeout);
      clearTimeout(completeTimeout);
      clearInterval(progressInterval);
    };
  }, [duration, onComplete]);

  const phaseLabel = phaseConfig 
    ? phaseConfig.phase === 1 
      ? 'Aquecimento' 
      : phaseConfig.phase === 2 
        ? 'Desafio' 
        : 'Extremo'
    : 'Aquecimento';

  const roundsLabel = phaseConfig?.rounds || 5;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <div className="max-w-md w-full mx-4">
        {/* Title */}
        <motion.div 
          className="text-center mb-8"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h2 className="font-orbitron text-2xl font-bold text-primary mb-2">
            DESAFIE O HÓRUS
          </h2>
          <p className="text-muted-foreground text-sm">
            Modo {phaseLabel} • {roundsLabel} Rodadas
          </p>
          {phaseConfig && phaseConfig.bcReward > 0 && (
            <p className="text-success text-xs mt-1">
              Prêmio: até {phaseConfig.bcReward.toLocaleString()} BC
            </p>
          )}
        </motion.div>

        {/* Players List */}
        <div className="luxury-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-orbitron text-sm text-foreground">
              JOGADORES NA MESA
            </span>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    player.isPlayer 
                      ? "bg-primary/10 border border-primary/30" 
                      : "bg-secondary/50 border border-border/30"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                    player.isPlayer
                      ? "bg-gradient-to-br from-primary to-primary/60"
                      : "bg-gradient-to-br from-secondary to-secondary/80"
                  )}>
                    {player.isPlayer ? (
                      <span className="text-sm font-bold text-primary-foreground">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <span>{player.avatar}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-orbitron text-sm font-bold text-foreground">
                      {player.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.isPlayer ? 'Você' : 'Pronto para jogar'}
                    </div>
                  </div>
                  {!player.isPlayer && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full bg-success"
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Waiting slots */}
            {players.length < 4 && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border/50 bg-secondary/20"
              >
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Aguardando jogador...
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{status}</span>
            <span className="text-primary font-orbitron">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/60"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
