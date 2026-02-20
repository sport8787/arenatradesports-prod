import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, ArrowLeft, RotateCcw, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrainingChampionScreenProps {
  wins: number;
  bank: number;
  bcEarned: number;
  onRestart: () => void;
  onBack: () => void;
}

function GoldParticle({ delay }: { delay: number }) {
  const x = Math.random() * 100;
  const size = 4 + Math.random() * 6;
  const dur = 2 + Math.random() * 3;
  return (
    <motion.div
      className="absolute rounded-full bg-[hsl(var(--arena-gold))]"
      style={{ width: size, height: size, left: `${x}%`, top: '-5%' }}
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 1, 0.8, 0], y: '110vh' }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeIn' }}
    />
  );
}

function GoldenTicket() {
  return (
    <motion.div
      initial={{ rotateY: 0, scale: 0 }}
      animate={{ rotateY: [0, 360, 720, 1080], scale: [0, 1.2, 1] }}
      transition={{ duration: 2.5, ease: 'easeOut' }}
      className="relative mx-auto"
    >
      <div className="w-72 h-40 rounded-2xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(43 74% 49%) 0%, hsl(38 92% 60%) 30%, hsl(43 74% 65%) 50%, hsl(38 92% 50%) 70%, hsl(43 74% 49%) 100%)',
          boxShadow: '0 0 40px hsl(43 74% 49% / 0.6), 0 0 80px hsl(43 74% 49% / 0.3)',
        }}
      >
        {/* Ticket perforations */}
        <div className="absolute left-6 top-0 bottom-0 flex flex-col justify-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full bg-black/30" />
          ))}
        </div>
        <div className="absolute right-6 top-0 bottom-0 flex flex-col justify-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full bg-black/30" />
          ))}
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-black">
          <Ticket className="w-8 h-8 mb-1 opacity-80" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">Arena Poker</p>
          <h3 className="font-mono text-lg font-black uppercase tracking-wider">Tiket Dourado</h3>
          <p className="font-mono text-[10px] uppercase tracking-wider opacity-70 mt-1">Torneio VIP</p>
        </div>

        {/* Shimmer */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
          }}
          animate={{ x: ['-200%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        />
      </div>
    </motion.div>
  );
}

const TrainingChampionScreen = ({ wins, bank, bcEarned, onRestart, onBack }: TrainingChampionScreenProps) => {
  const [showTicket, setShowTicket] = useState(false);

  // Show ticket after initial animation
  useState(() => {
    const t = setTimeout(() => setShowTicket(true), 1500);
    return () => clearTimeout(t);
  });

  // Play victory sound
  useState(() => {
    try {
      const audio = new Audio('/audio/horus/vitoria.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  });

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <GoldParticle key={i} delay={i * 0.1} />
      ))}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 12 }}
        className="relative z-10 text-center space-y-6 p-8 max-w-lg"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Trophy className="w-20 h-20 mx-auto text-[hsl(var(--arena-gold))] drop-shadow-[0_0_30px_hsl(var(--arena-gold)_/_0.6)]" />
        </motion.div>

        <div>
          <h1 className="font-mono text-3xl font-black uppercase tracking-[0.15em] text-[hsl(var(--arena-gold))] drop-shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.4)]">
            Campeão da Arena
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">
            Você dominou {wins} cenários consecutivos.
          </p>
        </div>

        {/* Golden Ticket Animation */}
        <AnimatePresence>
          {showTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4"
            >
              <p className="font-mono text-xs text-[hsl(var(--arena-gold))] uppercase tracking-widest mb-3 animate-pulse">
                🎫 Tiket de Torneio Dourado Desbloqueado!
              </p>
              <GoldenTicket />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Coins className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
            <span className="font-mono text-2xl font-black text-[hsl(var(--arena-gold))]">
              {bank.toLocaleString()} BC
            </span>
          </div>
          <p className="font-mono text-[10px] text-[hsl(var(--arena-gold)_/_0.6)]">
            +{bcEarned.toLocaleString()} BC creditados na sua carteira
          </p>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={onRestart} className="bg-[hsl(var(--arena-cyan))] text-black font-mono font-bold uppercase tracking-wider">
            <RotateCcw className="w-4 h-4 mr-2" /> Jogar Novamente
          </Button>
          <Button variant="outline" onClick={onBack} className="font-mono border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default TrainingChampionScreen;
