import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Brain, Eye, Clock } from 'lucide-react';
import { ShadowPlayer } from '@/types/bot';

interface VotingSimulationProps {
  shadowPlayers: ShadowPlayer[];
  onComplete: () => void;
  delayMs?: number; // Random delay between 5-12 seconds
}

const THINKING_PHRASES = [
  'Analisando tom de voz...',
  'Verificando hesitação...',
  'Comparando padrões...',
  'Detectando micro-expressões...',
  'Avaliando confiança...',
  'Processando resposta...',
];

export function VotingSimulation({ 
  shadowPlayers, 
  onComplete,
  delayMs 
}: VotingSimulationProps) {
  const [currentPhrase, setCurrentPhrase] = useState(THINKING_PHRASES[0]);
  const [playerStates, setPlayerStates] = useState<Record<string, 'waiting' | 'thinking' | 'decided'>>({});
  const [progress, setProgress] = useState(0);
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const totalDelayRef = useRef(delayMs || (5000 + Math.random() * 7000));
  
  // Keep callback ref updated
  onCompleteRef.current = onComplete;
  
  useEffect(() => {
    const totalDelay = totalDelayRef.current;
    
    // Initialize player states
    const initialStates: Record<string, 'waiting' | 'thinking' | 'decided'> = {};
    shadowPlayers.forEach(p => {
      initialStates[p.id] = 'waiting';
    });
    setPlayerStates(initialStates);
    
    // Rotate thinking phrases
    const phraseInterval = setInterval(() => {
      setCurrentPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    }, 1500);
    
    // Progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + (100 / (totalDelay / 100)), 100));
    }, 100);
    
    // Store timeout IDs for cleanup
    const timeoutIds: NodeJS.Timeout[] = [];
    
    // Simulate players starting to think at different times
    shadowPlayers.forEach((player, index) => {
      const startThinkingDelay = 500 + Math.random() * 1500;
      const thinkingTimeout = setTimeout(() => {
        setPlayerStates(prev => ({ ...prev, [player.id]: 'thinking' }));
      }, startThinkingDelay);
      timeoutIds.push(thinkingTimeout);
      
      // Each player decides at a random time before the total delay
      const decisionTime = (totalDelay * 0.3) + (index * (totalDelay * 0.2)) + Math.random() * 1000;
      const decisionTimeout = setTimeout(() => {
        setPlayerStates(prev => ({ ...prev, [player.id]: 'decided' }));
      }, decisionTime);
      timeoutIds.push(decisionTimeout);
    });
    
    // Complete after total delay
    const completeTimeout = setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    }, totalDelay);
    timeoutIds.push(completeTimeout);
    
    return () => {
      clearInterval(phraseInterval);
      clearInterval(progressInterval);
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [shadowPlayers]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 py-8"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/50"
        >
          <Clock className="w-8 h-8 text-primary" />
        </motion.div>
        
        <h3 className="font-orbitron text-lg text-foreground">
          Aguardando votos dos desafiantes...
        </h3>
        
        <motion.p 
          key={currentPhrase}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-sm text-muted-foreground"
        >
          {currentPhrase}
        </motion.p>
      </div>
      
      {/* Progress bar */}
      <div className="max-w-md mx-auto">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
      
      {/* Shadow Players voting indicators */}
      <div className="flex justify-center gap-6">
        {shadowPlayers.map((player) => {
          const state = playerStates[player.id] || 'waiting';
          
          return (
            <motion.div
              key={player.id}
              className="flex flex-col items-center gap-3"
            >
              {/* Avatar with state indicator */}
              <div className="relative">
                <motion.div
                  animate={state === 'thinking' ? { 
                    scale: [1, 1.1, 1],
                    boxShadow: ['0 0 0 2px hsl(var(--primary)/0.3)', '0 0 0 4px hsl(var(--primary)/0.1)', '0 0 0 2px hsl(var(--primary)/0.3)']
                  } : {}}
                  transition={{ duration: 1, repeat: state === 'thinking' ? Infinity : 0 }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
                    state === 'waiting' ? 'bg-secondary/50 opacity-60' :
                    state === 'thinking' ? 'bg-primary/20 border-2 border-primary/50' :
                    'bg-success/20 border-2 border-success/50'
                  }`}
                >
                  {player.avatar}
                </motion.div>
                
                {/* State badge */}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                  state === 'waiting' ? 'bg-muted' :
                  state === 'thinking' ? 'bg-primary' :
                  'bg-success'
                }`}>
                  {state === 'waiting' && <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                  {state === 'thinking' && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Brain className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                  {state === 'decided' && <Eye className="w-3 h-3 text-success-foreground" />}
                </div>
              </div>
              
              {/* Name */}
              <span className="text-xs text-muted-foreground font-orbitron">
                {player.nickname}
              </span>
              
              {/* Status text */}
              <AnimatePresence mode="sync">
                <motion.span
                  key={state}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`text-[10px] uppercase tracking-wider font-semibold ${
                    state === 'waiting' ? 'text-muted-foreground' :
                    state === 'thinking' ? 'text-primary' :
                    'text-success'
                  }`}
                >
                  {state === 'waiting' ? 'Esperando' :
                   state === 'thinking' ? 'Analisando...' :
                   'Votou ✓'}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      
      {/* Suspense message */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center"
      >
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Os jogadores estão deliberando...
        </p>
      </motion.div>
    </motion.div>
  );
}
