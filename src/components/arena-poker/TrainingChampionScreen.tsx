import { motion } from 'framer-motion';
import { Trophy, Coins, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrainingChampionScreenProps {
  wins: number;
  bank: number;
  apcEarned: number;
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

const TrainingChampionScreen = ({ wins, bank, apcEarned, onRestart, onBack }: TrainingChampionScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <GoldParticle key={i} delay={i * 0.15} />
      ))}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 12 }}
        className="relative z-10 text-center space-y-8 p-8"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Trophy className="w-24 h-24 mx-auto text-[hsl(var(--arena-gold))] drop-shadow-[0_0_30px_hsl(var(--arena-gold)_/_0.6)]" />
        </motion.div>

        <div>
          <h1 className="font-mono text-4xl font-black uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))] drop-shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.4)]">
            Campeão da Arena Poker
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-3">
            Você dominou {wins} cenários consecutivos.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Coins className="w-6 h-6 text-[hsl(var(--arena-gold))]" />
            <span className="font-mono text-3xl font-black text-[hsl(var(--arena-gold))]">
              {bank.toLocaleString()} APC
            </span>
          </div>
          <p className="font-mono text-xs text-[hsl(var(--arena-gold)_/_0.6)]">
            +{apcEarned.toLocaleString()} APC salvos no seu perfil
          </p>
        </div>

        <div className="flex justify-center gap-3 pt-4">
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
