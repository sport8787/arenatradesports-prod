import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, X, Wallet, Shield, Target, Zap } from 'lucide-react';
import type { Asset, TradePosition } from '@/pages/ArenaTrader';

interface TradePanelProps {
  balance: number;
  position: TradePosition | null;
  currentPrice: number;
  unrealizedPnl: number;
  onOpenPosition: (type: 'long' | 'short', amount: number, stopLoss?: number, takeProfit?: number, leverage?: number) => void;
  onClosePosition: () => void;
  asset: Asset;
}

const TRADE_AMOUNTS = [
  { label: '10K', value: 10000 },
  { label: '25K', value: 25000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
];

const LEVERAGE_OPTIONS = [1, 2, 5, 10];

export default function TradePanel({ balance, position, currentPrice, unrealizedPnl, onOpenPosition, onClosePosition, asset }: TradePanelProps) {
  const [selectedAmount, setSelectedAmount] = useState(25000);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slPercent, setSlPercent] = useState(3);
  const [tpPercent, setTpPercent] = useState(5);
  const [leverage, setLeverage] = useState(1);

  const computeSL = () => slEnabled ? +(currentPrice * (1 - slPercent / 100)).toFixed(2) : undefined;
  const computeTP = () => tpEnabled ? +(currentPrice * (1 + tpPercent / 100)).toFixed(2) : undefined;
  const computeShortSL = () => slEnabled ? +(currentPrice * (1 + slPercent / 100)).toFixed(2) : undefined;
  const computeShortTP = () => tpEnabled ? +(currentPrice * (1 - tpPercent / 100)).toFixed(2) : undefined;

  const liquidationPrice = leverage > 1
    ? +(currentPrice * (1 - 1 / leverage)).toFixed(2)
    : null;

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
            {position.leverage && position.leverage > 1 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {position.leverage}x
              </span>
            )}
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
      <div className="flex gap-2 mb-3">
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

      {/* Leverage selector */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className={`w-3.5 h-3.5 ${leverage > 1 ? 'text-amber-400' : 'text-white/30'}`} />
          <span className="text-xs font-bold text-white/60">Alavancagem</span>
          {leverage > 1 && (
            <span className="text-[10px] text-amber-400/70 ml-auto">
              ⚠ Liq. ~R$ {liquidationPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {LEVERAGE_OPTIONS.map((lev) => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              className={`
                flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
                ${leverage === lev
                  ? lev >= 5
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                    : 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:border-amber-500/30'
                }
              `}
            >
              {lev}x
            </button>
          ))}
        </div>
        {leverage >= 5 && (
          <p className="text-[10px] text-red-400/70 mt-1.5 italic">
            ⚡ Alavancagem alta — risco exponencial de liquidação forçada
          </p>
        )}
      </div>

      {/* SL/TP Controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Stop Loss */}
        <div className={`p-2.5 rounded-lg border transition-all ${slEnabled ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
          <button onClick={() => setSlEnabled(!slEnabled)} className="flex items-center gap-1.5 w-full mb-1.5">
            <Shield className={`w-3.5 h-3.5 ${slEnabled ? 'text-red-400' : 'text-white/30'}`} />
            <span className={`text-xs font-bold ${slEnabled ? 'text-red-400' : 'text-white/40'}`}>Stop Loss</span>
          </button>
          {slEnabled && (
            <div className="flex items-center gap-2">
              <input
                type="range" min="1" max="10" step="0.5"
                value={slPercent} onChange={(e) => setSlPercent(+e.target.value)}
                className="flex-1 h-1 accent-red-500"
              />
              <span className="text-xs font-bold text-red-400 w-8 text-right">-{slPercent}%</span>
            </div>
          )}
        </div>

        {/* Take Profit */}
        <div className={`p-2.5 rounded-lg border transition-all ${tpEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
          <button onClick={() => setTpEnabled(!tpEnabled)} className="flex items-center gap-1.5 w-full mb-1.5">
            <Target className={`w-3.5 h-3.5 ${tpEnabled ? 'text-emerald-400' : 'text-white/30'}`} />
            <span className={`text-xs font-bold ${tpEnabled ? 'text-emerald-400' : 'text-white/40'}`}>Take Profit</span>
          </button>
          {tpEnabled && (
            <div className="flex items-center gap-2">
              <input
                type="range" min="1" max="20" step="0.5"
                value={tpPercent} onChange={(e) => setTpPercent(+e.target.value)}
                className="flex-1 h-1 accent-emerald-500"
              />
              <span className="text-xs font-bold text-emerald-400 w-8 text-right">+{tpPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Buy/Sell buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => onOpenPosition('long', selectedAmount, computeSL(), computeTP(), leverage)}
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
          onClick={() => onOpenPosition('short', selectedAmount, computeShortSL(), computeShortTP(), leverage)}
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
