import { useEffect, useState } from 'react';
import { Trophy, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Row {
  rank: number;
  user_id: string;
  display_name: string;
  bc_week: number;
  wins_week: number;
}

/**
 * Top 10 acumuladores de BC nos últimos 7 dias.
 * Cria competição saudável + prova social ("outras pessoas estão ganhando BC de verdade").
 */
export default function BCLeaderboardWeekly() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('bc_leaderboard_weekly' as any)
        .select('*')
        .order('rank', { ascending: true })
        .limit(10);
      if (!active) return;
      if (error) console.warn('leaderboard erro', error);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-4 animate-pulse h-48" />
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-6 text-center">
        <Trophy className="h-8 w-8 text-yellow-400/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Ranking semanal começa amanhã. Faça entradas virtuais e vença para entrar no Top 10!
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
            Top 10 BC desta semana
          </h3>
        </div>
        {myRow && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Você: #{myRow.rank}
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => {
          const isMe = r.user_id === user?.id;
          const medal =
            r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
          return (
            <li
              key={r.user_id}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                isMe
                  ? 'bg-yellow-500/15 border border-yellow-500/40'
                  : 'bg-card/60 hover:bg-card/80'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs w-8 shrink-0 text-muted-foreground">
                  {medal}
                </span>
                <span className={`truncate ${isMe ? 'font-semibold text-foreground' : ''}`}>
                  {isMe ? 'Você' : r.display_name}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  · {r.wins_week} GREENs
                </span>
              </span>
              <span className="flex items-center gap-1 font-mono text-xs text-yellow-400 shrink-0">
                <Coins className="h-3 w-3" />
                {r.bc_week.toLocaleString('pt-BR')}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
