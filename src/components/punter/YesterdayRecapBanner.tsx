import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';

const SEEN_KEY = 'yesterday_recap_last_seen_date';

interface Recap {
  analyzed: number;
  approved: number;
  greens: number;
  reds: number;
  roi: number | null;
}

/**
 * Banner mostrado uma vez por dia no primeiro acesso à Arena Punter,
 * resumindo o desempenho do Mycroft no dia anterior.
 */
export default function YesterdayRecapBanner() {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen === today) return;
    } catch {}

    let cancelled = false;
    (async () => {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const [{ count: approvedCount }, { count: analyzedCount }, { data: signals }] = await Promise.all([
        supabase
          .from('punter_analyses')
          .select('id', { count: 'exact', head: true })
          .eq('verdict', 'APROVADO')
          .gte('commence_time', start.toISOString())
          .lte('commence_time', end.toISOString()),
        supabase
          .from('punter_analyses')
          .select('id', { count: 'exact', head: true })
          .gte('commence_time', start.toISOString())
          .lte('commence_time', end.toISOString()),
        supabase
          .from('punter_sinais')
          .select('odd, resultado')
          .gte('commence_time', start.toISOString())
          .lte('commence_time', end.toISOString())
          .limit(200),
      ]);

      if (cancelled) return;

      let greens = 0, reds = 0, profit = 0, staked = 0;
      for (const s of signals || []) {
        const r = String((s as any).resultado || '').toLowerCase();
        if (r !== 'green' && r !== 'red') continue;
        staked += 1;
        if (r === 'red') {
          reds += 1;
          profit -= 1;
        } else {
          greens += 1;
          const odd = (s as any).odd != null ? Number((s as any).odd) : null;
          profit += odd && odd > 1 ? odd - 1 : 0.85;
        }
      }
      const roi = staked > 0 ? (profit / staked) * 100 : null;

      // Não exibir banner se não houve atividade
      if ((approvedCount || 0) === 0 && (analyzedCount || 0) === 0) return;

      setRecap({
        analyzed: analyzedCount || 0,
        approved: approvedCount || 0,
        greens,
        reds,
        roi,
      });
      setHidden(false);
      track.custom('yesterday_recap_seen', { greens, reds, roi });
    })();
    return () => { cancelled = true; };
  }, []);

  if (hidden || !recap) return null;

  const handleDismiss = () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(SEEN_KEY, today);
    } catch {}
    setHidden(true);
  };

  const positive = recap.roi !== null && recap.roi > 0;
  const neutral = recap.roi === null || (recap.greens === 0 && recap.reds === 0);

  return (
    <div
      className={`rounded-xl border backdrop-blur-sm px-4 py-3 flex items-center gap-3 relative ${
        positive
          ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5'
          : neutral
          ? 'border-border/60 bg-card/70'
          : 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5'
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${
          positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/40 text-muted-foreground'
        }`}
      >
        {positive ? (
          <Sparkles className="w-5 h-5" />
        ) : recap.roi !== null && recap.roi < 0 ? (
          <TrendingDown className="w-5 h-5" />
        ) : (
          <TrendingUp className="w-5 h-5" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Resumo de ontem
        </p>
        <p className="text-sm text-foreground mt-0.5">
          O Mycroft analisou <strong>{recap.analyzed}</strong> jogos · aprovou <strong>{recap.approved}</strong>
          {recap.greens + recap.reds > 0 && (
            <>
              {' · '}
              <span className="text-emerald-400 font-semibold">{recap.greens}G</span>
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-red-400 font-semibold">{recap.reds}R</span>
            </>
          )}
          {recap.roi !== null && (
            <>
              {' · ROI '}
              <strong className={positive ? 'text-emerald-400' : 'text-red-400'}>
                {positive ? '+' : ''}
                {recap.roi.toFixed(1)}%
              </strong>
            </>
          )}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
