import { useEffect, useState, useCallback } from 'react';
import { Crown, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SinalFavorito {
  id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
  league_name: string | null;
  match_date: string | null;
  favorito: string | null;
  fav_odd: number | null;
  score_vitoria: number | null;
  score_over15: number | null;
  score_over25: number | null;
  status_vitoria: string | null;
  status_over15: string | null;
  status_over25: string | null;
}

const STATUS_TONE: Record<string, string> = {
  SINAL_FORTE: 'bg-success/15 text-success border-success/30',
  SINAL_BOM: 'bg-primary/15 text-primary border-primary/30',
};

function StatusChip({ label, status, score }: { label: string; status: string | null; score: number | null }) {
  if (!status || !['SINAL_FORTE', 'SINAL_BOM'].includes(status)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold ${STATUS_TONE[status]}`}
    >
      {label} {score ?? '—'} · {status === 'SINAL_FORTE' ? 'FORTE' : 'BOM'}
    </span>
  );
}

export default function PlanoFavoritoPanel() {
  const [signals, setSignals] = useState<SinalFavorito[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Apenas jogos futuros (a partir de agora) — não mostra jogos que já começaram/terminaram
    const fromDate = new Date().toISOString();
    const { data, error } = await supabase
      .from('sinais_favorito_prelive' as any)
      .select(
        'id,fixture_id,home_team,away_team,league_name,match_date,favorito,fav_odd,score_vitoria,score_over15,score_over25,status_vitoria,status_over15,status_over25',
      )
      .gte('match_date', fromDate)
      .or(
        'status_vitoria.in.(SINAL_FORTE,SINAL_BOM),status_over15.in.(SINAL_FORTE,SINAL_BOM),status_over25.in.(SINAL_FORTE,SINAL_BOM)',
      )
      .order('match_date', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[PlanoFavorito] load error', error);
    } else {
      setSignals((data ?? []) as unknown as SinalFavorito[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);


  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md bg-warning/15">
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
          </div>
          <div>
            <h3 className="text-[13px] sm:text-sm font-bold text-foreground leading-tight">Plano Favorito — Pré-Live</h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono leading-tight">
              Vitória do Favorito · Over 1.5 · Over 2.5 (odd 1.40-2.00)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 sm:h-8 px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-xs font-mono">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando sinais...
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-5 text-center">
          <TrendingUp className="w-6 h-6 mx-auto text-muted-foreground/60 mb-1.5" />
          <p className="text-xs text-muted-foreground">Nenhum sinal aprovado nas próximas horas.</p>
          <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
            Análise automática roda via cron.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => {
            const horario = s.match_date
              ? new Date(s.match_date).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';
            return (
              <li
                key={s.id}
                className="rounded-md border border-border/60 bg-background/40 p-2 sm:p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] sm:text-sm font-semibold text-foreground leading-tight break-words">
                      {s.home_team} <span className="text-muted-foreground">×</span> {s.away_team}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                      {s.league_name ?? '—'} · {horario}
                    </p>
                  </div>
                  {s.favorito && (
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] font-mono border-warning/40 text-warning shrink-0">
                      Fav: {s.favorito} {s.fav_odd ? `@ ${Number(s.fav_odd).toFixed(2)}` : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusChip label="VIT" status={s.status_vitoria} score={s.score_vitoria} />
                  <StatusChip label="O1.5" status={s.status_over15} score={s.score_over15} />
                  <StatusChip label="O2.5" status={s.status_over25} score={s.score_over25} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
