import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, TrendingUp, TrendingDown, X } from 'lucide-react';
import type { TradePosition, Asset, Candle } from '@/pages/ArenaTrader';

interface PortfolioPanelProps {
  positions: TradePosition[];
  candles: Record<string, Candle[]>; // symbol -> candles
  currentPrices: Record<string, number>; // symbol -> price
  onClosePosition: (index: number) => void;
}

export default function PortfolioPanel({ positions, currentPrices, onClosePosition }: PortfolioPanelProps) {
  if (positions.length === 0) return null;

  const totalUnrealized = positions.reduce((sum, pos) => {
    const price = currentPrices[pos.asset.symbol] || pos.entryPrice;
    const leverage = pos.leverage || 1;
    const change = (price - pos.entryPrice) / pos.entryPrice;
    const leveragedChange = change * leverage;
    const pnl = pos.type === 'long'
      ? Math.floor(pos.amount * leveragedChange)
      : Math.floor(pos.amount * -leveragedChange);
    return sum + pnl;
  }, 0);

  return (
    <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Portfolio ({positions.length})
        </h3>
        <span className={`font-mono text-sm font-bold ${totalUnrealized >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
          {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toLocaleString()} BC
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {positions.map((pos, i) => {
            const price = currentPrices[pos.asset.symbol] || pos.entryPrice;
            const leverage = pos.leverage || 1;
            const change = (price - pos.entryPrice) / pos.entryPrice;
            const leveragedChange = change * leverage;
            const pnl = pos.type === 'long'
              ? Math.floor(pos.amount * leveragedChange)
              : Math.floor(pos.amount * -leveragedChange);
            const pnlPct = (leveragedChange * 100).toFixed(2);
            const isWin = pnl >= 0;

            return (
              <motion.div
                key={`${pos.asset.symbol}-${pos.timestamp}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    pos.type === 'long' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {pos.type === 'long' ? 'L' : 'S'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{pos.asset.symbol}</div>
                    <div className="text-[10px] text-white/40">
                      {leverage > 1 ? `${leverage}x · ` : ''}{pos.amount.toLocaleString()} BC
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-xs font-mono font-bold ${isWin ? 'text-cyan-400' : 'text-red-400'}`}>
                      {isWin ? '+' : ''}{pnl.toLocaleString()}
                    </div>
                    <div className={`text-[10px] ${isWin ? 'text-cyan-400/60' : 'text-red-400/60'}`}>
                      {isWin ? '+' : ''}{pnlPct}%
                    </div>
                  </div>
                  <button
                    onClick={() => onClosePosition(i)}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors"
                    title="Fechar posição"
                  >
                    <X className="w-3.5 h-3.5 text-red-400/60 hover:text-red-400" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
