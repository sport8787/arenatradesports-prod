import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Volume2 } from 'lucide-react';

interface HorusTraderVoiceProps {
  message: string;
  muted: boolean;
}

export default function HorusTraderVoice({ message, muted }: HorusTraderVoiceProps) {
  const prevMessage = useRef('');

  useEffect(() => {
    if (message && message !== prevMessage.current && !muted) {
      prevMessage.current = message;
      // TTS could be triggered here in the future
    }
  }, [message, muted]);

  if (!message) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message.slice(0, 30)}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="bg-gradient-to-br from-[#1a1200] to-[#111111] border border-amber-500/30 rounded-xl p-4 shadow-lg shadow-amber-500/5"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-orbitron text-xs font-bold text-amber-400 uppercase">Hórus Premium</h3>
            <p className="text-[10px] text-amber-400/50">Voz do Mercado</p>
          </div>
          {!muted && (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="ml-auto"
            >
              <Volume2 className="w-3 h-3 text-amber-400/50" />
            </motion.div>
          )}
        </div>

        <p className="text-sm text-amber-100/80 leading-relaxed italic">
          "{message}"
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
