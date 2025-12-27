import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pool of random bot names
const BOT_NAMES = [
  'ShadowMind', 'CryptoHunter', 'NeonBlitz', 'VortexAce',
  'PhantomX', 'CyberPulse', 'DarkVenus', 'IronWolf',
  'QuantumZ', 'BlazeMaster', 'FrostByte', 'StormRider',
  'EchoNova', 'VenomStrike', 'ThunderX', 'SteelNinja',
  'CosmicRay', 'MidnightAce', 'NovaStar', 'ViperX',
];

interface FakeLobbyProps {
  playerName: string;
  onComplete: (bots: { id: string; name: string }[]) => void;
  duration?: number;
}

export function FakeLobby({ playerName, onComplete, duration = 5000 }: FakeLobbyProps) {
  const [players, setPlayers] = useState<{ id: string; name: string; isPlayer: boolean }[]>([
    { id: 'player', name: playerName, isPlayer: true }
  ]);
  const [status, setStatus] = useState('Procurando jogadores...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Shuffle and pick 3 random bot names
    const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const selectedBots = shuffled.slice(0, 3).map((name, i) => ({
      id: `bot-${i}`,
      name,
      isPlayer: false,
    }));

    // Add bots progressively
    const intervals: NodeJS.Timeout[] = [];
    const botsToAdd = [...selectedBots];

    const addBot = (index: number) => {
      if (index >= botsToAdd.length) return;
      
      const delay = (duration / 4) * (index + 1);
      const timeout = setTimeout(() => {
        setPlayers(prev => [...prev, botsToAdd[index]]);
        setStatus(index < 2 ? 'Jogador encontrado!' : 'Mesa completa!');
      }, delay);
      intervals.push(timeout);
    };

    // Add each bot with delay
    addBot(0);
    addBot(1);
    addBot(2);

    // Progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 100));
    }, duration / 50);

    // Complete after duration
    const completeTimeout = setTimeout(() => {
      onComplete(selectedBots.map(b => ({ id: b.id, name: b.name })));
    }, duration);

    return () => {
      intervals.forEach(clearTimeout);
      clearTimeout(completeTimeout);
      clearInterval(progressInterval);
    };
  }, [duration, onComplete]);

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
            Modo Aquecimento • 5 Rodadas
          </p>
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
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    player.isPlayer
                      ? "bg-gradient-to-br from-primary to-primary/60"
                      : "bg-gradient-to-br from-purple-600 to-purple-900"
                  )}>
                    {player.isPlayer ? (
                      <span className="text-sm font-bold text-primary-foreground">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Bot className="w-5 h-5 text-purple-200" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-orbitron text-sm font-bold text-foreground">
                      {player.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.isPlayer ? 'Você' : 'Shadow Player'}
                    </div>
                  </div>
                  {!player.isPlayer && (
                    <div className="text-xs text-purple-400 font-orbitron">
                      🤖
                    </div>
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
