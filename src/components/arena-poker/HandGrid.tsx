import { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, Zap, Trophy, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ParsedHand } from '@/lib/handHistoryParser';

interface HandGridProps {
  hands: ParsedHand[];
  onSelectHand: (hand: ParsedHand) => void;
}

const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColor: Record<string, string> = {
  s: 'text-foreground',
  h: 'text-red-500',
  d: 'text-blue-400',
  c: 'text-green-400',
};

const HandGrid = ({ hands, onSelectHand }: HandGridProps) => {
  const [filterCritical, setFilterCritical] = useState(false);

  const displayed = filterCritical ? hands.filter(h => h.isCritical) : hands;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[20px] font-bold uppercase tracking-wider text-[hsl(var(--arena-gold))]">
          Mãos da Sessão
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterCritical(!filterCritical)}
          className={`font-mono text-xs uppercase tracking-wider transition-all ${
            filterCritical
              ? 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))] border-[hsl(var(--arena-gold)_/_0.4)]'
              : 'border-border text-muted-foreground'
          }`}
        >
          <Filter className="w-3 h-3 mr-1.5" />
          Mãos Críticas ({hands.filter(h => h.isCritical).length})
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {displayed.map((hand, index) => (
          <motion.button
            key={hand.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectHand(hand)}
            className={`relative text-left p-4 rounded-lg border transition-all hover:scale-[1.02] hover:shadow-lg ${
              hand.heroWon
                ? 'border-[hsl(var(--arena-gold)_/_0.4)] bg-[hsl(var(--arena-gold)_/_0.05)] hover:shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.15)]'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            {hand.isCritical && (
              <div className="absolute top-2 right-2">
                <Zap className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
              </div>
            )}

            {/* Cards - 2x larger */}
            <div className="flex items-center gap-1 mb-3">
              {hand.heroCards.map((card, i) => (
                <div
                  key={i}
                  className={`w-12 h-16 rounded-md border flex flex-col items-center justify-center font-bold text-lg ${
                    hand.heroWon
                      ? 'border-[hsl(var(--arena-gold)_/_0.6)] bg-[hsl(var(--arena-gold)_/_0.1)] shadow-[0_0_12px_hsl(var(--arena-gold)_/_0.2)]'
                      : 'border-border bg-secondary'
                  }`}
                >
                  <span className={suitColor[card.suit]}>{card.rank}</span>
                  <span className={`text-sm ${suitColor[card.suit]}`}>{suitSymbol[card.suit]}</span>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground uppercase">{hand.heroPosition}</span>
                <span className={`font-mono text-xs font-bold ${hand.heroWon ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                  {hand.heroWon ? 'WON' : 'LOST'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-foreground">{hand.potSizeBB}BB</span>
                {hand.isAllIn && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--destructive)_/_0.2)] text-[hsl(var(--destructive))] uppercase">
                    All-in
                  </span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {hand.streets.map(s => (
                  <span key={s} className="text-[10px] font-mono text-muted-foreground/60">{s}</span>
                ))}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-12 text-muted-foreground font-mono text-sm">
          {filterCritical ? 'Nenhuma mão crítica encontrada.' : 'Nenhuma mão importada.'}
        </div>
      )}
    </div>
  );
};

export default HandGrid;
