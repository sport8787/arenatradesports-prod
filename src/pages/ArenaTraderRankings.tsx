import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, BarChart3, Medal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TraderRank {
  username: string;
  atc_balance: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  best_trade_profit: number;
  worst_trade_loss: number;
  total_profit_loss: number;
}

export default function ArenaTraderRankings() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<TraderRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'balance' | 'winrate' | 'pnl'>('balance');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('arena_trader_rankings')
        .select('username, atc_balance, total_trades, winning_trades, losing_trades, best_trade_profit, worst_trade_loss, total_profit_loss')
        .order('atc_balance', { ascending: false })
        .limit(50);
      setRankings((data as TraderRank[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const sorted = [...rankings].sort((a, b) => {
    if (sortBy === 'balance') return b.atc_balance - a.atc_balance;
    if (sortBy === 'pnl') return b.total_profit_loss - a.total_profit_loss;
    const wrA = a.total_trades ? a.winning_trades / a.total_trades : 0;
    const wrB = b.total_trades ? b.winning_trades / b.total_trades : 0;
    return wrB - wrA;
  });

  const medalColor = (i: number) => {
    if (i === 0) return 'text-amber-400';
    if (i === 1) return 'text-slate-300';
    if (i === 2) return 'text-orange-500';
    return 'text-white/40';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/arena-trader')} className="text-amber-400/80 hover:text-amber-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-orbitron text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 uppercase tracking-wider">
            Ranking Arena Trader
          </h1>
        </div>

        {/* Sort Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'balance' as const, label: 'Saldo', icon: BarChart3 },
            { key: 'winrate' as const, label: 'Win Rate', icon: TrendingUp },
            { key: 'pnl' as const, label: 'P&L Total', icon: Trophy },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sortBy === key
                  ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-white/40 py-20 font-orbitron text-sm">Carregando rankings...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-white/40 py-20">Nenhum trader registrado ainda.</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((r, i) => {
              const winRate = r.total_trades > 0 ? ((r.winning_trades / r.total_trades) * 100).toFixed(1) : '0';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    i < 3
                      ? 'bg-gradient-to-r from-amber-400/10 to-transparent border-amber-400/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className={`w-8 text-center font-orbitron font-bold text-sm ${medalColor(i)}`}>
                    {i < 3 ? <Medal className="w-5 h-5 mx-auto" /> : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{r.username}</p>
                    <p className="text-[10px] text-white/40">{r.total_trades} trades · WR {winRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-orbitron text-sm font-bold text-amber-400">
                      {r.atc_balance.toLocaleString()} <span className="text-[10px]">BC</span>
                    </p>
                    <p className={`text-[10px] ${r.total_profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.total_profit_loss >= 0 ? '+' : ''}{r.total_profit_loss.toLocaleString()} P&L
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
