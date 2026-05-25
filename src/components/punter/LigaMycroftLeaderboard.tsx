import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Eye, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Row {
  rank: number;
  user_id: string | null;
  seed_id: string | null;
  is_horus: boolean;
  is_fake: boolean;
  display_name: string;
  total_bets: number;
  greens: number;
  reds: number;
  roi_pct: number;
  plan?: string | null;
  plan_active?: boolean | null;
}

/**
 * Liga Mycroft — ranking por ROI%.
 * Mostra Hórus + usuários fake seedados + usuários reais com ≥5 entradas liquidadas.
 * ROI premia consistência e não volume.
 */
export default function LigaMycroftLeaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('liga_mycroft_leaderboard' as any)
        .select('*')
        .order('rank', { ascending: true })
        .limit(15);
      if (!active) return;
      if (error) console.warn('[liga_mycroft_leaderboard]', error);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-4 animate-pulse h-72" />
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-6 text-center">
        <Trophy className="h-8 w-8 text-yellow-400/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Ranking abrindo. Faça pelo menos 5 entradas virtuais para entrar na disputa.
        </p>
      </div>
    );
  }

  const myRow = rows.find((r) => r.user_id === user?.id);

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/5 to-transparent p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-yellow-400 font-bold">
            Liga Mycroft · Top ROI
          </h3>
        </div>
        {myRow && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Você: #{myRow.rank}
          </span>
        )}
      </div>

      <p className="text-[10px] font-mono text-muted-foreground mb-3 leading-snug">
        Ranking por <span className="text-yellow-400 font-semibold">ROI%</span> (retorno sobre stake).
        Mínimo 5 entradas liquidadas. Quem é mais <span className="text-foreground font-semibold">consistente</span> sobe — não quem entrada mais.
      </p>

      <ol className="space-y-1.5">
        {rows.map((r) => {
          const isMe = !!user?.id && r.user_id === user.id;
          const medal =
            r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
          const roiColor =
            r.roi_pct >= 25
              ? 'text-emerald-400'
              : r.roi_pct >= 10
              ? 'text-yellow-400'
              : r.roi_pct >= 0
              ? 'text-muted-foreground'
              : 'text-red-400';

          return (
            <li
              key={r.user_id ?? r.seed_id}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                isMe
                  ? 'bg-yellow-500/15 border border-yellow-500/40'
                  : r.is_horus
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-card/60 hover:bg-card/80'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono text-xs w-8 shrink-0 text-muted-foreground">
                  {medal}
                </span>
                <span
                  className={`truncate flex items-center gap-1.5 ${
                    isMe
                      ? 'font-semibold text-foreground'
                      : r.is_horus
                      ? 'font-semibold text-primary'
                      : ''
                  }`}
                >
                  {r.is_horus && <Eye className="h-3 w-3 text-primary shrink-0" />}
                  {isMe ? 'Você' : r.display_name}
                  {r.plan_active && r.plan === 'premium' && (
                    <span
                      title="Assinante Premium · 2x BC"
                      className="inline-flex items-center gap-0.5 rounded bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-500/50 px-1 py-[1px] text-[9px] font-bold text-yellow-300 shrink-0"
                    >
                      <Crown className="h-2.5 w-2.5" />
                      PREMIUM
                    </span>
                  )}
                  {r.plan_active && r.plan === 'base' && (
                    <span
                      title="Plano Base · 1.5x BC"
                      className="inline-flex items-center rounded bg-blue-500/20 border border-blue-500/40 px-1 py-[1px] text-[9px] font-bold text-blue-300 shrink-0"
                    >
                      BASE
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                  · {r.greens}G/{r.reds}R · {r.total_bets} aps
                </span>
              </span>
              <span
                className={`flex items-center gap-1 font-mono text-xs font-semibold shrink-0 ${roiColor}`}
              >
                <TrendingUp className="h-3 w-3" />
                {r.roi_pct >= 0 ? '+' : ''}
                {Number(r.roi_pct).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
