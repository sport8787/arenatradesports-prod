import { motion } from 'framer-motion';

interface Prize {
  name: string;
  value: number;
  icon: string;
}

interface ProgressToPrizeProps {
  currentBC: number;
}

export default function ProgressToPrize({ currentBC }: ProgressToPrizeProps) {
  const prizes: Prize[] = [
    { name: "Pix R$ 50", value: 50000, icon: "💸" },
    { name: "GiftCard R$ 500", value: 100000, icon: "🎁" },
    { name: "Pix R$ 1.000", value: 200000, icon: "💰" },
    { name: "PlayStation 5", value: 800000, icon: "🎮" },
    { name: "iPhone 16 Pro", value: 1000000, icon: "📱" }
  ];

  const nextPrize = prizes.find(p => p.value > currentBC) || prizes[prizes.length - 1];
  const progress = Math.min((currentBC / nextPrize.value) * 100, 100);
  const remaining = Math.max(nextPrize.value - currentBC, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gradient-to-br from-gold/10 via-primary/5 to-gold/10 border border-gold/30 rounded-xl p-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 mb-3">
        <motion.span 
          className="text-3xl"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {nextPrize.icon}
        </motion.span>
        <div className="flex-1">
          <p className="text-base font-bold text-gold mb-0.5">
            {nextPrize.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Faltam <strong className="text-foreground font-semibold">{remaining.toLocaleString('pt-BR')}</strong> BC
          </p>
        </div>
      </div>
      
      <div className="relative w-full h-6 bg-background/50 rounded-full overflow-hidden border border-border/30">
        <motion.div 
          className="h-full bg-gradient-to-r from-gold via-amber-500 to-orange-500 rounded-full flex items-center justify-end pr-2 relative overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Shimmer effect */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          {progress >= 10 && (
            <span className="text-xs font-bold text-background z-10 drop-shadow-sm">
              {Math.floor(progress)}%
            </span>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
