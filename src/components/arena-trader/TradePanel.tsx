import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, X, Wallet } from 'lucide-react';
import type { Asset, TradePosition } from '@/pages/ArenaTrader';

interface TradePanelProps {
  balance: number;
  position: TradePosition | null;
  currentPrice: number;
  unrealizedPnl: number;
  onOpenPosition: (type: 'long' | 'short', amount: number) => void;
  onClosePosition: () => void;
  asset: Asset;
}

const TRADE_AMOUNTS = [
  { label: '10K', value: 10000 },
  { label: '25K', value: 25000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
];

export default function TradePanel({ balance, position, currentPrice, unrealizedPnl, onOpenPosition, onClosePosition, asset }: TradePanelProps) {
  const [selectedAmount, setSelectedAmount] = useState(25000);

  if (position) {
    const pnlPercent = ((unrealizedPnl / position.amount) * 100).toFixed(2);
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 bg-[#111111] border border-amber-900/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              position.type === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {position.type === 'long' ? 'LONG' : 'SHORT'}
            </span>
            <span className="font-orbitron text-sm text-white">{position.asset.symbol}</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40">Entrada: R$ {position.entryPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-white/40">Volume: {position.amount.toLocaleString()} BC</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-white/40">P&L Não-Realizado</div>
            <div className={`font-orbitron text-xl font-bold ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toLocaleString()} BC
            </div>
            <div className={`text-xs ${unrealizedPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              ({unrealizedPnl >= 0 ? '+' : ''}{pnlPercent}%)
            </div>
          </div>
          <motion.button
            onClick={onClosePosition}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-orbitron font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            FECHAR POSIÇÃO
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mt-3 bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400/60" />
          <span className="text-xs text-white/40">Volume da operação:</span>
        </div>
        <span className="font-orbitron text-xs text-amber-400">{selectedAmount.toLocaleString()} BC</span>
      </div>

      {/* Amount selector */}
      <div className="flex gap-2 mb-4">
        {TRADE_AMOUNTS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedAmount(opt.value)}
            disabled={opt.value > balance}
            className={`
              flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
              ${selectedAmount === opt.value
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                : 'bg-white/5 border border-white/10 text-white/50 hover:border-amber-500/30'
              }
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Buy/Sell buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => onOpenPosition('long', selectedAmount)}
          disabled={selectedAmount > balance}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            py-3 rounded-xl font-orbitron font-bold text-sm
            bg-gradient-to-b from-emerald-500 to-emerald-700
            hover:from-emerald-400 hover:to-emerald-600
            text-white shadow-lg shadow-emerald-500/20
            flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all
          "
        >
          <TrendingUp className="w-5 h-5" />
          COMPRAR
        </motion.button>

        <motion.button
          onClick={() => onOpenPosition('short', selectedAmount)}
          disabled={selectedAmount > balance}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            py-3 rounded-xl font-orbitron font-bold text-sm
            bg-gradient-to-b from-red-500 to-red-700
            hover:from-red-400 hover:to-red-600
            text-white shadow-lg shadow-red-500/20
            flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all
          "
        >
          <TrendingDown className="w-5 h-5" />
          VENDER
        </motion.button>
      </div>
    </div>
  );
}
