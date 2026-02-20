import { motion } from 'framer-motion';

interface Card {
  rank: string;
  suit: 's' | 'h' | 'd' | 'c';
}

interface HandVisualizerProps {
  playerCards: Card[];
  boardCards: Card[];
  positions?: { hero: string; villain?: string };
}

const suitSymbols: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColors: Record<string, string> = {
  s: 'text-white',
  c: 'text-white',
  h: 'text-red-500',
  d: 'text-[hsl(var(--arena-cyan))]',
};

const CardComponent = ({ card, delay = 0 }: { card: Card; delay?: number }) => (
  <motion.div
    initial={{ rotateY: 180, opacity: 0 }}
    animate={{ rotateY: 0, opacity: 1 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    className="w-12 h-16 sm:w-14 sm:h-20 rounded-md border border-[hsl(var(--arena-gold)_/_0.4)] bg-gradient-to-br from-[hsl(0_0%_12%)] to-[hsl(0_0%_6%)] flex flex-col items-center justify-center shadow-lg"
    style={{ boxShadow: '0 0 12px hsl(var(--arena-gold) / 0.15)' }}
  >
    <span className={`text-lg sm:text-xl font-bold font-mono ${suitColors[card.suit]}`}>
      {card.rank}
    </span>
    <span className={`text-sm ${suitColors[card.suit]}`}>
      {suitSymbols[card.suit]}
    </span>
  </motion.div>
);

const EmptySlot = () => (
  <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-md border border-dashed border-[hsl(0_0%_20%)] bg-black/40 flex items-center justify-center">
    <span className="text-[hsl(0_0%_25%)] text-xs font-mono">?</span>
  </div>
);

const HandVisualizer = ({ playerCards, boardCards, positions }: HandVisualizerProps) => {
  const boardSlots = 5;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative border border-[hsl(var(--arena-gold)_/_0.2)] bg-black/60 rounded-lg p-5 backdrop-blur-sm"
    >
      {/* Table felt gradient */}
      <div className="absolute inset-0 rounded-lg bg-[radial-gradient(ellipse_at_center,hsl(140_40%_8%_/_0.3),transparent_70%)]" />

      <div className="relative z-10 space-y-5">
        {/* Position info */}
        {positions?.hero && (
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--arena-gold)_/_0.7)]">
              Hero: {positions.hero}
            </span>
            {positions.villain && (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Villain: {positions.villain}
              </span>
            )}
          </div>
        )}

        {/* Board */}
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Board</span>
          <div className="flex justify-center gap-2">
            {Array.from({ length: boardSlots }).map((_, i) =>
              boardCards[i] ? (
                <CardComponent key={i} card={boardCards[i]} delay={i * 0.15} />
              ) : (
                <EmptySlot key={i} />
              )
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[hsl(var(--arena-gold)_/_0.3)] to-transparent" />
          <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[hsl(var(--arena-gold)_/_0.5)]">Hero</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[hsl(var(--arena-gold)_/_0.3)] to-transparent" />
        </div>

        {/* Player cards */}
        <div className="flex justify-center gap-3">
          {playerCards.length > 0 ? (
            playerCards.map((card, i) => (
              <CardComponent key={i} card={card} delay={0.6 + i * 0.15} />
            ))
          ) : (
            <>
              <EmptySlot />
              <EmptySlot />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default HandVisualizer;
