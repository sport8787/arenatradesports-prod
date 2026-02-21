import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown, ChevronUp, Brain, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Snapshot {
  id: string;
  trade_type: string;
  asset_symbol: string;
  entry_price: number;
  exit_price: number | null;
  amount: number;
  leverage: number;
  pnl: number | null;
  mycroft_analysis: any;
  horus_message: string | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
  session_id: string;
}

export default function SessionReplayPanel() {
  const { profile, isAuthenticated } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !profile) return;
    loadSnapshots();
  }, [isAuthenticated, profile]);

  const loadSnapshots = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('trader_session_snapshots')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20);
      if (data) setSnapshots(data as Snapshot[]);
    } catch (e) {
      console.error('Error loading snapshots:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || snapshots.length === 0) return null;

  const totalPnl = snapshots.reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = snapshots.length > 0
    ? Math.round((snapshots.filter(t => (t.pnl || 0) > 0).length / snapshots.length) * 100)
    : 0;

  return (
    <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase flex items-center gap-2">
          <History className="w-4 h-4" />
          Replay de Sessão
        </h3>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${totalPnl >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()} BC
          </span>
          <span className="text-[10px] text-white/40">{winRate}% win</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {snapshots.map((snap) => (
                <button
                  key={snap.id}
                  onClick={() => setSelectedTrade(selectedTrade?.id === snap.id ? null : snap)}
                  className={`w-full text-left rounded-lg px-3 py-2 border transition-all ${
                    selectedTrade?.id === snap.id
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-black/30 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(snap.pnl || 0) >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      }
                      <span className="text-xs font-bold text-white">{snap.trade_type.toUpperCase()} {snap.asset_symbol}</span>
                      {snap.leverage > 1 && <span className="text-[10px] text-amber-400/60">{snap.leverage}x</span>}
                    </div>
                    <span className={`text-xs font-mono font-bold ${(snap.pnl || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                      {(snap.pnl || 0) >= 0 ? '+' : ''}{(snap.pnl || 0).toLocaleString()} BC
                    </span>
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">
                    {new Date(snap.opened_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}Entrada: {Number(snap.entry_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {snap.exit_price && ` → Saída: ${Number(snap.exit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </div>

                  {/* Mycroft analysis expand */}
                  <AnimatePresence>
                    {selectedTrade?.id === snap.id && snap.mycroft_analysis && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 pt-2 border-t border-white/5"
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <Brain className="w-3 h-3 text-amber-400/60" />
                          <span className="text-[10px] text-amber-400/60 font-bold">Mycroft Analysis</span>
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          {snap.mycroft_analysis.verdict || 'Análise não disponível.'}
                        </p>
                        {snap.horus_message && (
                          <p className="text-[10px] text-amber-400/40 mt-1 italic">
                            "{snap.horus_message}"
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
