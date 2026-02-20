import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PharaohIcon } from './PersonaIcons';

const TRASH_TALK_PHRASES = [
  "Tick-tock… O feltro não espera eternamente.",
  "Eu já sei sua decisão. Você é que ainda não percebeu.",
  "Cuidado, cada segundo de hesitação conta uma história.",
  "O vilão está sorrindo. Você deveria se perguntar por quê.",
  "Posição, stack, cartas… Tudo grita a resposta. Você escuta?",
  "Sua hesitação é o maior tell que você poderia dar.",
  "Os fracos folddam por medo. Os tolos callam por ego. E você?",
  "Eu apostaria que você já sabe a jogada certa. Só falta coragem.",
];

const TIMEOUT_TAUNTS = [
  "Vai decidir hoje ou quer que eu peça um café pro vilão?",
  "O timer está correndo e sua banca não espera!",
  "Se demorar mais, até o dealer vai dormir.",
  "A inação também é uma decisão — e das piores.",
];

interface HorusTrashTalkProps {
  active: boolean;
  scenarioStartTime: number;
}

export function HorusTrashTalk({ active, scenarioStartTime }: HorusTrashTalkProps) {
  const [phrase, setPhrase] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showPhrase = useCallback((text: string) => {
    setPhrase(text);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 4000);
  }, []);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    // Initial trash talk after 3 seconds
    const initialDelay = setTimeout(() => {
      showPhrase(TRASH_TALK_PHRASES[Math.floor(Math.random() * TRASH_TALK_PHRASES.length)]);
    }, 3000);

    // Recurring trash talk every 8-12s
    const interval = setInterval(() => {
      const elapsed = (Date.now() - scenarioStartTime) / 1000;
      if (elapsed > 20) {
        showPhrase(TIMEOUT_TAUNTS[Math.floor(Math.random() * TIMEOUT_TAUNTS.length)]);
      } else {
        showPhrase(TRASH_TALK_PHRASES[Math.floor(Math.random() * TRASH_TALK_PHRASES.length)]);
      }
    }, 8000 + Math.random() * 4000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, scenarioStartTime, showPhrase]);

  return (
    <AnimatePresence>
      {visible && phrase && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="border border-[hsl(var(--arena-gold)_/_0.4)] rounded-xl p-4 bg-[hsl(var(--arena-gold)_/_0.06)] backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--arena-gold)_/_0.2)] flex items-center justify-center flex-shrink-0">
              <PharaohIcon className="text-[hsl(var(--arena-gold))]" size={18} />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold block mb-1">
                Hórus provoca:
              </span>
              <p className="font-mono text-sm text-[hsl(var(--arena-gold))] italic leading-relaxed">
                "{phrase}"
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Reaction emojis
interface ReactionButtonsProps {
  onReaction: (emoji: string) => void;
}

export function ReactionButtons({ onReaction }: ReactionButtonsProps) {
  const [lastReaction, setLastReaction] = useState<{ emoji: string; key: number } | null>(null);

  const reactions = [
    { emoji: '🔥', label: 'Fogo' },
    { emoji: '🤔', label: 'Hmm' },
    { emoji: '😈', label: 'Diabólico' },
    { emoji: '💀', label: 'RIP' },
  ];

  const handleReaction = (emoji: string) => {
    setLastReaction({ emoji, key: Date.now() });
    onReaction(emoji);
    // Play a subtle click sound
    try {
      const audio = new Audio('/audio/horus/bip.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 justify-center">
        {reactions.map(({ emoji, label }) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleReaction(emoji)}
            className="w-10 h-10 rounded-full bg-secondary/50 hover:bg-secondary border border-border hover:border-[hsl(var(--arena-gold)_/_0.3)] flex items-center justify-center text-lg transition-colors"
            title={label}
          >
            {emoji}
          </motion.button>
        ))}
      </div>

      {/* Floating emoji animation */}
      <AnimatePresence>
        {lastReaction && (
          <motion.div
            key={lastReaction.key}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute left-1/2 -translate-x-1/2 text-3xl pointer-events-none"
          >
            {lastReaction.emoji}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
