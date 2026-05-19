import { motion } from 'framer-motion';
import { RANKS, type Rank } from '@/lib/blackjack/live/liveTypes';

interface Props {
  onPick: (rank: Rank) => void;
  disabled?: boolean;
  label?: string;
}

export default function CardKeypad({ onPick, disabled, label }: Props) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="grid grid-cols-7 gap-2">
        {RANKS.map(r => (
          <motion.button
            key={r}
            type="button"
            whileTap={{ scale: 0.9 }}
            disabled={disabled}
            onClick={() => onPick(r)}
            className={`h-12 rounded-lg text-base font-bold transition-all border ${
              disabled
                ? 'bg-muted/30 text-muted-foreground/30 border-transparent cursor-not-allowed'
                : 'bg-secondary text-foreground border-border hover:bg-primary hover:text-primary-foreground hover:border-primary'
            }`}
          >
            {r}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
