import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { centralAudioQueue, AUDIO_PRIORITY } from '@/services/centralAudioQueue';
import { Eye, Flame, Trophy, Zap, Skull } from 'lucide-react';
import horusAvatar from '@/assets/horus-avatar.png';

type CinematicStage = 'intro' | 'dialogue' | 'reward' | 'outro' | 'idle';

interface CinematicEventProps {
  show: boolean;
  type: 'epic_moment' | 'blefe_perfeito' | 'carta_bonus' | 'evento_oculto' | 'climax';
  title?: string;
  subtitle?: string;
  narration?: string; // Text for Hórus to speak
  audioPath?: string;
  onComplete?: () => void;
  duration?: number;
  cardType?: 'porto_seguro' | 'imunidade';
  reward?: {
    card?: 'porto_seguro' | 'imunidade';
    bluffcoins?: number;
  };
}

// Utility delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CinematicEvent = ({
  show,
  type,
  title,
  subtitle,
  narration,
  audioPath,
  onComplete,
  duration = 5000,
  cardType = 'porto_seguro',
  reward
}: CinematicEventProps) => {
  const [stage, setStage] = useState<CinematicStage>('idle');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Typewriter effect for narration
  const typewriterEffect = useCallback(async (text: string) => {
    setIsTyping(true);
    setDisplayedText('');
    
    for (let i = 0; i <= text.length; i++) {
      setDisplayedText(text.substring(0, i));
      await delay(30); // 30ms per character
    }
    
    setIsTyping(false);
  }, []);

  // Main sequence effect
  useEffect(() => {
    if (!show) {
      setStage('idle');
      setDisplayedText('');
      return;
    }

    const runSequence = async () => {
      // Stage 1: Intro - Fade to black with cinematic bars
      setStage('intro');
      await delay(800);

      // Stage 2: Dialogue - Show Hórus avatar and speak
      setStage('dialogue');
      
      // Play audio using centralized queue with proper priority
      if (audioPath) {
        centralAudioQueue.enqueue(audioPath, {
          label: 'cinematic_dialogue',
          priority: AUDIO_PRIORITY.NARRATIVE_EVENT
        });
      }
      
      // Typewriter effect for narration text
      if (narration || subtitle) {
        await typewriterEffect(narration || subtitle || '');
      }
      
      // Wait for narration to be read
      await delay(narration ? Math.max(2000, narration.length * 50) : 1500);

      // Stage 3: Reward - Show card or reward animation
      if (type === 'blefe_perfeito' || type === 'carta_bonus' || reward?.card) {
        setStage('reward');
        await delay(3000);
      }

      // Stage 4: Outro - Fade out
      setStage('outro');
      await delay(800);

      // Complete
      setStage('idle');
      onComplete?.();
    };

    runSequence();
  }, [show, audioPath, narration, subtitle, type, reward, typewriterEffect, onComplete]);

  const getCardImage = () => {
    const effectiveCardType = reward?.card || cardType;
    if (type === 'blefe_perfeito') {
      return '/carta_blefe.png';
    }
    return effectiveCardType === 'imunidade' ? '/carta_blefe.png' : '/carta_claro.png';
  };

  const getCardGlow = () => {
    const effectiveCardType = reward?.card || cardType;
    if (type === 'blefe_perfeito') return 'shadow-[0_0_80px_rgba(255,215,0,0.9)]';
    return effectiveCardType === 'imunidade' 
      ? 'shadow-[0_0_80px_rgba(147,51,234,0.9)]' 
      : 'shadow-[0_0_80px_rgba(34,197,94,0.9)]';
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'blefe_perfeito': return <Trophy className="w-8 h-8 text-yellow-400" />;
      case 'carta_bonus': return <Zap className="w-8 h-8 text-primary" />;
      case 'evento_oculto': return <Eye className="w-8 h-8 text-purple-400" />;
      case 'climax': return <Flame className="w-8 h-8 text-red-500" />;
      default: return <Skull className="w-8 h-8 text-amber-400" />;
    }
  };

  if (stage === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Cinematic Black Bars */}
      <motion.div
        className="absolute top-0 left-0 right-0 bg-black z-10"
        initial={{ height: 0 }}
        animate={{ 
          height: stage === 'outro' ? 0 : '12%' 
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-black z-10"
        initial={{ height: 0 }}
        animate={{ 
          height: stage === 'outro' ? 0 : '12%' 
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />

      {/* Dark overlay */}
      <motion.div 
        className="absolute inset-0 bg-black/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === 'outro' ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Atmospheric background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%]"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 50%)',
          }}
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Content container - centered between black bars */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6" style={{ top: '12%', bottom: '12%' }}>
        
        <AnimatePresence mode="wait">
          {/* ===== INTRO STAGE ===== */}
          {stage === 'intro' && (
            <motion.div
              key="intro"
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Pulsing type icon */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {getTypeIcon()}
              </motion.div>
            </motion.div>
          )}

          {/* ===== DIALOGUE STAGE ===== */}
          {stage === 'dialogue' && (
            <motion.div
              key="dialogue"
              className="flex flex-col items-center gap-8 max-w-2xl"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.5 }}
            >
              {/* Hórus Avatar */}
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15 }}
              >
                {/* Avatar glow */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, transparent 70%)' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                {/* Avatar container with real image */}
                <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-primary/30 via-primary/20 to-transparent border-4 border-primary/60 flex items-center justify-center overflow-hidden">
                  {/* Real Hórus avatar image */}
                  <motion.img
                    src={horusAvatar}
                    alt="Hórus"
                    className="w-full h-full object-cover"
                    animate={{ 
                      filter: [
                        'brightness(1) drop-shadow(0 0 10px hsl(var(--primary)))',
                        'brightness(1.2) drop-shadow(0 0 30px hsl(var(--primary)))',
                        'brightness(1) drop-shadow(0 0 10px hsl(var(--primary)))'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                
                {/* Name tag */}
                <motion.div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-background/90 rounded-full border border-primary/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="font-orbitron text-sm text-primary font-bold">HÓRUS</span>
                </motion.div>
              </motion.div>

              {/* Dialogue text box */}
              <motion.div
                className="relative bg-card/95 backdrop-blur-lg rounded-xl p-6 border border-primary/30 shadow-2xl max-w-lg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                {/* Speech bubble pointer */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-card/95 border-l border-t border-primary/30 rotate-45" />
                
                {/* Text content */}
                <p className="text-lg md:text-xl text-foreground leading-relaxed text-center relative z-10">
                  {displayedText}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-0.5 h-5 bg-primary ml-1"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </p>
              </motion.div>

              {/* Title below dialogue */}
              {title && (
                <motion.h2
                  className="text-2xl md:text-4xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-300 to-primary"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  style={{ textShadow: '0 0 30px hsl(var(--primary) / 0.5)' }}
                >
                  {title}
                </motion.h2>
              )}
            </motion.div>
          )}

          {/* ===== REWARD STAGE ===== */}
          {stage === 'reward' && (
            <motion.div
              key="reward"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Reward card with spring animation */}
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', duration: 0.8, bounce: 0.4 }}
              >
                {/* Card glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-xl blur-2xl"
                  style={{
                    background: type === 'blefe_perfeito' 
                      ? 'radial-gradient(circle, rgba(255,215,0,0.7) 0%, transparent 70%)'
                      : (reward?.card || cardType) === 'imunidade'
                        ? 'radial-gradient(circle, rgba(147,51,234,0.7) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(34,197,94,0.7) 0%, transparent 70%)'
                  }}
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
                
                {/* Card image with 3D spin */}
                <motion.div
                  className="relative"
                  animate={{ 
                    rotateY: [0, 360, 720],
                  }}
                  transition={{
                    duration: 2,
                    ease: 'easeInOut'
                  }}
                  style={{ perspective: 1000 }}
                >
                  <img
                    src={getCardImage()}
                    alt="Carta Bônus"
                    className={`w-52 h-80 object-cover rounded-xl ${getCardGlow()}`}
                    style={{ transformStyle: 'preserve-3d' }}
                  />
                </motion.div>

                {/* Sparkle particles */}
                {[...Array(16)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      top: '50%',
                      left: '50%',
                      background: type === 'blefe_perfeito' 
                        ? '#FFD700' 
                        : (reward?.card || cardType) === 'imunidade' 
                          ? '#9333EA' 
                          : '#22C55E'
                    }}
                    animate={{
                      x: [0, Math.cos(i * 22.5 * Math.PI / 180) * 150],
                      y: [0, Math.sin(i * 22.5 * Math.PI / 180) * 150],
                      opacity: [1, 0],
                      scale: [1, 0]
                    }}
                    transition={{
                      duration: 1.2,
                      delay: 0.3,
                      ease: 'easeOut'
                    }}
                  />
                ))}
              </motion.div>

              {/* Reward title */}
              <motion.h2
                className="text-3xl md:text-5xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                style={{ textShadow: '0 0 40px rgba(255,215,0,0.6)' }}
              >
                {title || 'CONQUISTA DESBLOQUEADA!'}
              </motion.h2>

              {/* BluffCoins reward */}
              {reward?.bluffcoins && (
                <motion.div
                  className="flex items-center gap-2 px-6 py-3 bg-primary/20 rounded-full border border-primary/50"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <span className="text-2xl">💰</span>
                  <span className="font-orbitron text-2xl text-primary font-bold">
                    +{reward.bluffcoins.toLocaleString()} BC
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ===== OUTRO STAGE ===== */}
          {stage === 'outro' && (
            <motion.div
              key="outro"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CinematicEvent;
