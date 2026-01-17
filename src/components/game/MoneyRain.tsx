import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { DollarSign, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { centralAudioQueue, AUDIO_PRIORITY } from '@/services/centralAudioQueue';

interface MoneyRainProps {
  show: boolean;
  amount: number;
  playerName?: string;
  onComplete?: () => void;
}

interface MoneyBill {
  id: number;
  x: number;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
  type: 'bill' | 'coin';
}

export default function MoneyRain({ show, amount, playerName, onComplete }: MoneyRainProps) {
  const [bills, setBills] = useState<MoneyBill[]>([]);
  const hasNarratedRef = useRef(false);

  // Generate congratulation text
  const congratsText = playerName 
    ? `Parabéns, ${playerName}! Você completou o desafio!`
    : 'Parabéns! Você completou o desafio!';

  useEffect(() => {
    if (show) {
      // Generate money bills
      const newBills: MoneyBill[] = [];
      const billCount = Math.min(40, 20 + Math.floor(amount / 50000));
      
      for (let i = 0; i < billCount; i++) {
        newBills.push({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 1.5,
          duration: 2 + Math.random() * 2,
          rotation: Math.random() * 720 - 360,
          size: 0.6 + Math.random() * 0.6,
          type: Math.random() > 0.3 ? 'bill' : 'coin',
        });
      }
      setBills(newBills);

      // Play applause and narrate congratulations via ElevenLabs
      if (!hasNarratedRef.current) {
        hasNarratedRef.current = true;
        playApplause();
        // Delay narration slightly so applause starts first
        setTimeout(() => {
          narrateCongratulations(congratsText);
        }, 500);
      }

      // Trigger onComplete after animation
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      setBills([]);
      hasNarratedRef.current = false;
    }
  }, [show, amount, onComplete, congratsText]);

  const playApplause = () => {
    try {
      console.log('[MoneyRain] Playing victory audio');
      // Use local victory audio files as celebration sound
      const victoryAudios = [
        '/audio/horus/vitoria.mp3',
        '/audio/horus/vitoria2.mp3',
        '/audio/horus/vitoria3.mp3',
        '/audio/horus/vitoria4.mp3',
      ];
      const randomAudio = victoryAudios[Math.floor(Math.random() * victoryAudios.length)];
      const audio = new Audio(randomAudio);
      audio.volume = 0.5;
      audio.play().catch(console.error);
    } catch (err) {
      console.error('[MoneyRain] Failed to play victory audio:', err);
    }
  };

  const narrateCongratulations = async (text: string) => {
    try {
      console.log('[MoneyRain] Requesting TTS for:', text);
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text,
          voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George voice for Horus
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.6,
        },
      });

      if (error) {
        console.error('[MoneyRain] TTS error:', error);
        return;
      }

      if (data?.audioUrl) {
        console.log('[MoneyRain] Playing congratulations audio');
        centralAudioQueue.enqueue(data.audioUrl, {
          label: 'horus_congratulations',
          priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        });
      }
    } catch (err) {
      console.error('[MoneyRain] Failed to narrate:', err);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Central celebration text */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            <div className="text-center z-10">
              <motion.div
                className="text-6xl mb-4"
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                💰
              </motion.div>
              <motion.h2
                className="font-orbitron text-2xl md:text-3xl font-black text-green-400 mb-2 max-w-lg mx-auto"
                style={{
                  textShadow: '0 0 30px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.3)'
                }}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {congratsText}
              </motion.h2>
              <motion.p
                className="text-2xl md:text-3xl font-bold text-white"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                +{amount.toLocaleString()} BC
              </motion.p>
            </div>
          </motion.div>

          {/* Falling money */}
          {bills.map((bill) => (
            <motion.div
              key={bill.id}
              className="absolute -top-20"
              style={{ 
                left: `${bill.x}%`,
                transform: `scale(${bill.size})`,
              }}
              initial={{ 
                y: -100,
                rotate: 0,
                opacity: 0 
              }}
              animate={{ 
                y: '120vh',
                rotate: bill.rotation,
                opacity: [0, 1, 1, 0.8, 0]
              }}
              transition={{
                duration: bill.duration,
                delay: bill.delay,
                ease: "easeIn"
              }}
            >
              {bill.type === 'bill' ? (
                <div className="relative">
                  {/* Bill design */}
                  <div className="w-16 h-8 bg-gradient-to-br from-green-500 via-green-600 to-green-700 rounded-sm border border-green-400/50 flex items-center justify-center shadow-lg">
                    <div className="absolute inset-0.5 border border-green-400/30 rounded-sm" />
                    <DollarSign className="w-5 h-5 text-green-200" />
                  </div>
                </div>
              ) : (
                <motion.div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-gold via-amber-400 to-gold flex items-center justify-center shadow-lg border-2 border-amber-300"
                  animate={{ rotateY: 360 }}
                  transition={{ 
                    duration: 0.5, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                >
                  <span className="font-bold text-background text-sm">B</span>
                </motion.div>
              )}
            </motion.div>
          ))}

          {/* Sparkle effects */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute w-2 h-2 bg-gold rounded-full"
              style={{
                left: `${10 + i * 12}%`,
                top: '50%',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
                y: [-50, -100],
              }}
              transition={{
                duration: 1,
                delay: 0.8 + i * 0.1,
                repeat: 2,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
