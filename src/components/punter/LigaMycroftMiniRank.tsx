import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Eye, ChevronRight, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Row {
  rank: number;
  user_id: string | null;
  seed_id: string | null;
  is_horus: boolean;
  display_name: string;
  total_bets: number;
  greens: number;
  roi_pct: number;
}

/**
 * Mini ranking compacto da Liga Mycroft no /punter.
 * Mostra top 3 + posição do usuário (se estiver no ranking) ou CTA pra entrar.
 * Cria gatilho competitivo a cada visita ao menu.
 */
export default function LigaMycroftMiniRank() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [top, setTop] = useState<Row[]>([]);
  const [me, setMe] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Top 3
      const { data: topData } = await supabase
        .from('liga_mycroft_leaderboard' as any)
        .select('*')
        .order('rank', { ascending: true })
        .limit(3);

      // Posição do usuário (se existir)
      let myRow: Row | null = null;
      if (user?.id) {
        const { data: meData } = await supabase
          .from('liga_mycroft_leaderboard' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        myRow = (meData as any) || null;
      }

      if (!active) return;
      setTop((topData as any[]) || []);
      setMe(myRow);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-3 h-28 animate-pulse" />;
  }

  const userInTop3 = me && top.some((r) => r.user_id === me.user_id);

  return (
    <button
      onClick={() => navigate('/loja-bc')}
      className="w-full text-left rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent p-3 hover:border-yellow-500/50 transition group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-yellow-400 font-bold">
            Liga Mycroft · Top 3 ROI
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono text-yellow-400 font-bold">
          Ver ranking
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
        </span>
      </div>

      <ol className="space-y-1">
        {top.map((r) => {
          const isMe = !!user?.id && r.user_id === user.id;
          const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉';
          return (
            <li
              key={r.user_id ?? r.seed_id}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                isMe
                  ? 'bg-yellow-500/15 border border-yellow-500/40'
                  : r.is_horus
                  ? 'bg-primary/10'
                  : ''
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm shrink-0">{medal}</span>
                {r.is_horus && <Eye className="h-3 w-3 text-primary shrink-0" />}
                <span
                  className={`truncate ${
                    isMe ? 'font-semibold text-foreground' : r.is_horus ? 'text-primary font-semibold' : 'text-foreground/90'
                  }`}
                >
                  {isMe ? 'Você' : r.display_name}
                </span>
              </span>
              <span className="font-mono text-[11px] font-bold text-emerald-400 shrink-0">
                +{Number(r.roi_pct).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ol>

      {/* Linha "sua posição" */}
      <div className="mt-2 pt-2 border-t border-yellow-500/15 flex items-center justify-between text-[11px]">
        {me ? (
          userInTop3 ? (
            <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Você está no Top 3 — defenda a posição!
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">
                Sua posição: <span className="text-foreground font-semibold">#{me.rank}</span> · ROI{' '}
                <span className="text-foreground font-semibold">
                  {me.roi_pct >= 0 ? '+' : ''}
                  {Number(me.roi_pct).toFixed(1)}%
                </span>
              </span>
              <span className="text-yellow-400 font-mono">Subir →</span>
            </>
          )
        ) : (
          <span className="text-muted-foreground">
            Faça <span className="text-foreground font-semibold">5 operações</span> liquidadas (Punter ou Trader Ao Vivo) para entrar.
          </span>
        )}
      </div>
    </button>
  );
}
