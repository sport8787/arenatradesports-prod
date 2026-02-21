import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface TraderBalanceHeaderProps {
  balance: number;
  unrealizedPnl: number;
}

export default function TraderBalanceHeader({ balance, unrealizedPnl }: TraderBalanceHeaderProps) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-amber-900/30 px-4 py-2"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-6">
        {/* Balance */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
          <Wallet className="w-4 h-4 text-amber-400" />
          <span className="font-orbitron text-sm font-bold text-amber-400">
            {balance.toLocaleString()}
          </span>
          <span className="text-xs text-amber-400/70">BC</span>
        </div>

        {/* Unrealized PnL */}
        {unrealizedPnl !== 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              unrealizedPnl >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {unrealizedPnl >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`font-orbitron text-xs font-bold ${
              unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toLocaleString()}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
