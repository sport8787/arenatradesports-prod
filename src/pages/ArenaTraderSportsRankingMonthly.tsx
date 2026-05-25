import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Medal, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RankRow {
  user_id: string;
  username: string;
  total_pnl: number;
  greens: number;
  reds: number;
  cashouts: number;
  total_settled: number;
  win_rate: number;
}

function monthBoundsISO(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
}

export default function ArenaTraderSportsRankingMonthly() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { start, end, label } = useMemo(() => monthBoundsISO(), []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // 1) Pega todas entradas resolvidas do mês
      const { data: entries, error } = await supabase
        .from('arena_trader_entries')
        .select('user_id, status, pnl, result')
        .gte('created_at', start)
        .lt('created_at', end)
        .in('status', ['green', 'red', 'cashout']);

      if (error || !entries) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Agrega por user_id
      const map = new Map<string, RankRow>();
      for (const e of entries as any[]) {
        const cur = map.get(e.user_id) ?? {
          user_id: e.user_id,
          username: 'Trader',
          total_pnl: 0,
          greens: 0,
          reds: 0,
          cashouts: 0,
          total_settled: 0,
          win_rate: 0,
        };
        cur.total_pnl += Number(e.pnl) || 0;
        cur.total_settled += 1;
        if (e.status === 'green') cur.greens += 1;
        else if (e.status === 'red') cur.reds += 1;
        else if (e.status === 'cashout') cur.cashouts += 1;
        map.set(e.user_id, cur);
      }

      const userIds = Array.from(map.keys());
      if (userIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 3) Busca usernames
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      const nameMap = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => nameMap.set(p.user_id, p.username || 'Trader'));

      // 4) Calcula win_rate e ordena por P&L desc
      const ranked = Array.from(map.values())
        .map((r) => ({
          ...r,
          username: nameMap.get(r.user_id) ?? 'Trader',
          win_rate: r.total_settled > 0 ? Math.round((r.greens / r.total_settled) * 100) : 0,
        }))
        .sort((a, b) => b.total_pnl - a.total_pnl)
        .slice(0, 50);

      setRows(ranked);
      setLoading(false);
    };

    fetch();
  }, [start, end]);

  const myRank = user ? rows.findIndex((r) => r.user_id === user.id) : -1;
  const myRow = myRank >= 0 ? rows[myRank] : null;

  const medalColor = (i: number) => {
    if (i === 0) return 'text-amber-400';
    if (i === 1) return 'text-slate-300';
    if (i === 2) return 'text-orange-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate('/punter/menu')}
            className="text-primary/80 hover:text-primary"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-orbitron text-xl font-bold uppercase tracking-wider">
            Ranking Mensal — Trader Sports
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 ml-9">
          <Calendar className="w-3.5 h-3.5" />
          <span className="capitalize">{label} • Top 50 por P&L virtual</span>
        </div>

        {/* Minha posição (se fora do top 50 mostra card destacado) */}
        {user && myRow && myRank >= 10 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 border border-primary/40 bg-primary/5 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-8 text-center font-orbitron font-bold text-sm text-primary">#{myRank + 1}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{myRow.username} <span className="text-xs text-primary">(você)</span></p>
              <p className="text-[10px] text-muted-foreground">
                {myRow.greens}G • {myRow.reds}R • {myRow.cashouts}C • WR {myRow.win_rate}%
              </p>
            </div>
            <div className={`text-right font-orbitron text-sm font-bold ${myRow.total_pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
              {myRow.total_pnl >= 0 ? '+' : '−'}R$ {Math.abs(myRow.total_pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-20 font-orbitron text-sm">Carregando ranking...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum trader liquidou entradas este mês ainda.</p>
            <p className="text-xs mt-1 opacity-60">Seja o primeiro a aparecer aqui!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const isMe = user?.id === r.user_id;
              const isProfit = r.total_pnl >= 0;
              return (
                <motion.div
                  key={r.user_id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isMe
                      ? 'bg-primary/10 border-primary/50'
                      : i < 3
                        ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/30'
                        : 'bg-card border-border'
                  }`}
                >
                  <div className={`w-8 text-center font-orbitron font-bold text-sm ${medalColor(i)}`}>
                    {i < 3 ? <Medal className="w-5 h-5 mx-auto" /> : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">
                      {r.username}
                      {isMe && <span className="text-xs text-primary ml-1">(você)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.greens}G • {r.reds}R • {r.cashouts}C • WR {r.win_rate}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-orbitron text-sm font-bold flex items-center gap-1 justify-end ${isProfit ? 'text-success' : 'text-destructive'}`}>
                      {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isProfit ? '+' : '−'}R$ {Math.abs(r.total_pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.total_settled} entradas</p>
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
