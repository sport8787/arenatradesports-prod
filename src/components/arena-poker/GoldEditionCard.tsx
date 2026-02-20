import { motion } from 'framer-motion';

interface GoldEditionCardProps {
  rank: string;
  suit: string;
  isLeak?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColor: Record<string, string> = {
  s: 'text-foreground',
  h: 'text-red-500',
  d: 'text-blue-400',
  c: 'text-green-400',
};

const sizeClasses = {
  sm: 'w-12 h-[4.5rem] text-lg',
  md: 'w-16 h-24 text-2xl',
  lg: 'w-20 h-[7.5rem] text-3xl',
};

export function GoldEditionCard({ rank, suit, isLeak = false, size = 'md' }: GoldEditionCardProps) {
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={`relative ${sizeClasses[size].split(' ').slice(0, 2).join(' ')} rounded-xl flex flex-col items-center justify-center
        ${isLeak
          ? 'border-2 border-[hsl(var(--destructive))] shadow-[0_0_25px_hsl(var(--destructive)_/_0.5),inset_0_0_15px_hsl(var(--destructive)_/_0.1)]'
          : 'border-2 border-[hsl(var(--arena-gold))] shadow-[0_0_25px_hsl(var(--arena-gold)_/_0.4)]'
        }
        overflow-hidden
      `}
      style={{
        background: isLeak
          ? 'linear-gradient(145deg, hsl(0 72% 51% / 0.15) 0%, hsl(0 0% 6%) 40%, hsl(0 72% 51% / 0.08) 100%)'
          : 'linear-gradient(145deg, hsl(43 74% 49% / 0.2) 0%, hsl(0 0% 6%) 40%, hsl(43 74% 49% / 0.1) 100%)',
      }}
    >
      {/* Gold foil texture overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            ${isLeak ? 'hsl(0 72% 51% / 0.3)' : 'hsl(43 74% 49% / 0.3)'} 2px,
            ${isLeak ? 'hsl(0 72% 51% / 0.3)' : 'hsl(43 74% 49% / 0.3)'} 4px
          )`,
        }}
      />

      {/* Embossed suit watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] text-6xl pointer-events-none">
        {suitSymbol[suit]}
      </div>

      {/* Card content */}
      <span className={`font-bold relative z-10 ${sizeClasses[size].split(' ').slice(2).join(' ')} ${suitColor[suit]}`}>
        {rank}
      </span>
      <span className={`relative z-10 ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-lg'} ${suitColor[suit]}`}>
        {suitSymbol[suit]}
      </span>

      {/* Corner rank indicators */}
      <span className={`absolute top-1 left-1.5 font-mono text-[8px] font-bold ${suitColor[suit]} opacity-60`}>
        {rank}
      </span>
      <span className={`absolute bottom-1 right-1.5 font-mono text-[8px] font-bold ${suitColor[suit]} opacity-60 rotate-180`}>
        {rank}
      </span>

      {/* Leak pulse animation */}
      {isLeak && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-[hsl(var(--destructive))]"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Shimmer effect */}
      {!isLeak && (
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, hsl(43 74% 70% / 0.4) 50%, transparent 70%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
      )}
    </motion.div>
  );
}

export function parseCards(str: string) {
  const cards: { rank: string; suit: string }[] = [];
  for (let i = 0; i < str.length; i += 2) {
    if (i + 1 < str.length) {
      cards.push({ rank: str[i], suit: str[i + 1].toLowerCase() });
    }
  }
  return cards;
}
