import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, TrendingDown, Target, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

type Arena = 'trader_sports' | 'punter';

interface State {
  sample_size: number;
  greens: number;
  reds: number;
  hit_rate: number;
  roi: number;
  base_min_confidence: number;
  effective_min_confidence: number;
  delta: number;
  last_settled_at: string | null;
}

interface Props {
  arena?: Arena;
  className?: string;
}

export default function CalibrationCard({ arena = 'trader_sports', className }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from('arena_calibration_state')
        .select('*')
        .eq('arena', arena)
        .maybeSingle();
      if (mounted) {
        setState(data as State | null);
        setLoading(false);
      }
    }
    load();
    const ch = supabase
      .channel(`calibration-${arena}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'arena_calibration_state',
        filter: `arena=eq.${arena}`,
      }, (p: any) => { if (mounted && p.new) setState(p.new as State); })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [arena]);

  if (loading || !state || state.sample_size === 0) return null;

  const hitPct = (state.hit_rate * 100).toFixed(1);
  const roiPct = (state.roi * 100).toFixed(1);
  const hitTone = state.hit_rate >= 0.6 ? 'text-[hsl(142,71%,55%)]' : state.hit_rate >= 0.5 ? 'text-[hsl(43,96%,60%)]' : 'text-[hsl(0,84%,65%)]';
  const roiTone = state.roi > 0 ? 'text-[hsl(142,71%,55%)]' : state.roi >= -0.05 ? 'text-[hsl(43,96%,60%)]' : 'text-[hsl(0,84%,65%)]';
  const deltaLabel = state.delta > 0 ? `+${state.delta} (mais restritivo)` : state.delta < 0 ? `${state.delta} (mais permissivo)` : 'neutro';
  const deltaTone = state.delta > 0 ? 'text-[hsl(0,84%,65%)]' : state.delta < 0 ? 'text-[hsl(142,71%,55%)]' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-xl border border-border bg-card/60 backdrop-blur-md px-4 py-3 mb-4', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-orbitron uppercase tracking-widest text-muted-foreground">
          Calibração — últimas {state.sample_size} operações
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Cell icon={<Target className="w-3 h-3" />} label="Acerto" value={`${hitPct}%`} sub={`${state.greens}G / ${state.reds}R`} tone={hitTone} />
        <Cell icon={state.roi >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} label="ROI/op" value={`${state.roi >= 0 ? '+' : ''}${roiPct}%`} sub="por unidade" tone={roiTone} />
        <Cell icon={<Gauge className="w-3 h-3" />} label="Limite atual" value={`${state.effective_min_confidence}%`} sub={`base ${state.base_min_confidence}%`} tone="text-foreground" />
        <Cell icon={<Activity className="w-3 h-3" />} label="Ajuste" value={deltaLabel} sub="auto" tone={deltaTone} />
      </div>
    </div>
  );
}

function Cell({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[9px] font-orbitron uppercase tracking-wider text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className={cn('text-base font-orbitron font-bold leading-none', tone)}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
