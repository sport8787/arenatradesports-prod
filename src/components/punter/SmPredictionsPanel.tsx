import { useState } from 'react';
import { Loader2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SmPredictions {
  home_win: number | null;
  draw: number | null;
  away_win: number | null;
  over_25: number | null;
  under_25: number | null;
  btts_yes: number | null;
  btts_no: number | null;
  over_15: number | null;
  under_15: number | null;
  over_35: number | null;
  under_35: number | null;
}

interface Props {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  smFixtureId?: number | null;
  className?: string;
}

function ProbBar({ label, value, highlight = false }: { label: string; value: number | null; highlight?: boolean }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 70 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-primary' :
    pct >= 35 ? 'bg-amber-500' : 'bg-muted-foreground/40';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color, highlight && 'ring-1 ring-offset-0')} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[11px] font-mono font-bold w-9 text-right', highlight ? 'text-foreground' : 'text-muted-foreground')}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function SmPredictionsPanel({ matchId, homeTeam, awayTeam, commenceTime, smFixtureId, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<SmPredictions | null>(null);
  const [cached, setCached] = useState(false);
  const [open, setOpen] = useState(false);
  const [fixtureId, setFixtureId] = useState<number | null>(null);

  async function fetchPredictions() {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sportmonks-predictions-fetch', {
        body: {
          match_id: matchId,
          home_team: homeTeam,
          away_team: awayTeam,
          commence_time: commenceTime,
          sm_fixture_id: smFixtureId ?? undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || 'Previsões SM indisponíveis para este jogo');
        return;
      }
      setPredictions(data.predictions);
      setCached(!!data.cached);
      setFixtureId(data.fixture_id ?? null);
      setOpen(true);
      if (!data.cached) toast.success('✅ Previsões Sportmonks carregadas');
    } catch (e: any) {
      console.error('[SmPredictions] error', e);
      toast.error(e?.message || 'Erro ao buscar previsões Sportmonks');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        size="sm"
        variant="outline"
        onClick={predictions ? () => setOpen(!open) : fetchPredictions}
        disabled={loading}
        className="w-full font-mono text-[10px] tracking-wider border-sky-500/40 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/70 h-7"
      >
        {loading ? (
          <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> BUSCANDO PREVISÕES SM...</>
        ) : predictions ? (
          open
            ? <><ChevronUp className="mr-1.5 h-3 w-3" /> OCULTAR PREVISÕES SM</>
            : <><ChevronDown className="mr-1.5 h-3 w-3" /> MOSTRAR PREVISÕES SM</>
        ) : (
          <><TrendingUp className="mr-1.5 h-3 w-3" /> PREVISÕES SPORTMONKS</>
        )}
      </Button>

      {open && predictions && (
        <div className="rounded border border-sky-500/20 bg-sky-950/20 p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest">
              Previsões Sportmonks{fixtureId ? ` · fixture #${fixtureId}` : ''}
            </span>
            {cached && <span className="text-[8px] font-mono text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">cache</span>}
          </div>

          {/* 1X2 */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Resultado (1X2)</p>
            <ProbBar label={homeTeam.split(' ').slice(0, 2).join(' ')} value={predictions.home_win} highlight />
            <ProbBar label="Empate" value={predictions.draw} />
            <ProbBar label={awayTeam.split(' ').slice(0, 2).join(' ')} value={predictions.away_win} />
          </div>

          {/* Gols */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Mercado de Gols</p>
            {predictions.over_15 != null && <ProbBar label="Over 1.5" value={predictions.over_15} />}
            <ProbBar label="Over 2.5" value={predictions.over_25} highlight />
            <ProbBar label="Under 2.5" value={predictions.under_25} />
            {predictions.over_35 != null && <ProbBar label="Over 3.5" value={predictions.over_35} />}
          </div>

          {/* BTTS */}
          {(predictions.btts_yes != null || predictions.btts_no != null) && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Ambas Marcam (BTTS)</p>
              <ProbBar label="Sim" value={predictions.btts_yes} highlight />
              <ProbBar label="Não" value={predictions.btts_no} />
            </div>
          )}

          <p className="text-[8px] font-mono text-muted-foreground/50 text-right pt-1">
            Powered by Sportmonks Predictions API · Apenas referência, não constitui conselho de aposta
          </p>
        </div>
      )}
    </div>
  );
}
