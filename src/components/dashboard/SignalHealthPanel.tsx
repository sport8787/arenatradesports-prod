import { cn } from '@/lib/utils';
import { Activity, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { FutoddsPressureIndices, FutoddsPressureWindow } from '@/hooks/useLiveMatches';

export interface SignalHealthStats {
  pressure_indices?: FutoddsPressureIndices;
  last5min_stats?: FutoddsPressureWindow;
  last10min_stats?: FutoddsPressureWindow;
}

interface Props {
  market: string;
  stats?: SignalHealthStats | null;
}

type Side = 'home' | 'away' | 'totals' | 'defensive';

function detectSide(market: string): Side {
  const m = market.toLowerCase();
  if (/lay|under/.test(m)) return 'defensive';
  if (/(home|casa|^1\b|\b1x|mandante)/.test(m)) return 'home';
  if (/(away|fora|^2\b|x2\b|visitante)/.test(m)) return 'away';
  return 'totals'; // Over / BTTS / Corners Over / etc.
}

type Tone = 'green' | 'amber' | 'red' | 'muted';
const toneClass: Record<Tone, string> = {
  green: 'text-[hsl(142,71%,55%)] border-[hsl(142,71%,45%)]/40 bg-[hsl(142,71%,45%)]/10',
  amber: 'text-[hsl(43,96%,60%)] border-[hsl(43,96%,55%)]/40 bg-[hsl(43,96%,55%)]/10',
  red: 'text-[hsl(0,84%,65%)] border-[hsl(0,84%,60%)]/40 bg-[hsl(0,84%,60%)]/10',
  muted: 'text-muted-foreground border-border/40 bg-muted/20',
};

function Pill({
  icon, label, value, tone, hint,
}: { icon: React.ReactNode; label: string; value: string; tone: Tone; hint?: string }) {
  return (
    <div className={cn('flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg border px-1.5 py-1', toneClass[tone])}>
      <div className="flex items-center gap-1 text-[8px] font-orbitron uppercase tracking-wider opacity-80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xs font-orbitron font-bold leading-tight">{value}</div>
      {hint && <div className="text-[8px] opacity-70 leading-tight truncate">{hint}</div>}
    </div>
  );
}

function trendIcon(delta: number) {
  if (delta > 4) return <TrendingUp className="w-2.5 h-2.5" />;
  if (delta < -4) return <TrendingDown className="w-2.5 h-2.5" />;
  return <Minus className="w-2.5 h-2.5" />;
}

export default function SignalHealthPanel({ market, stats }: Props) {
  if (!stats) return null;
  const { pressure_indices: pi, last5min_stats: l5, last10min_stats: l10 } = stats;
  if (!pi && !l5 && !l10) return null;

  const side = detectSide(market);

  // ===== Indicador 1: Pressão (favorável vs adversa) =====
  let pressTone: Tone = 'muted';
  let pressVal = '—';
  let pressHint: string | undefined;
  if (pi && (pi.home != null || pi.away != null)) {
    const h = pi.home ?? 0;
    const a = pi.away ?? 0;
    if (side === 'home' || side === 'away') {
      const our = side === 'home' ? h : a;
      const opp = side === 'home' ? a : h;
      const delta = our - opp;
      pressVal = `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`;
      pressHint = `${our.toFixed(0)} vs ${opp.toFixed(0)}`;
      if (delta >= 15) pressTone = 'green';
      else if (delta >= -10) pressTone = 'amber';
      else pressTone = 'red';
    } else if (side === 'totals') {
      const total = (pi.total ?? h + a);
      pressVal = total.toFixed(0);
      pressHint = `${h.toFixed(0)}H ${a.toFixed(0)}A`;
      if (total >= 110) pressTone = 'green';
      else if (total >= 70) pressTone = 'amber';
      else pressTone = 'red';
    } else { // defensive (Under/Lay) — menos pressão = melhor
      const total = (pi.total ?? h + a);
      pressVal = total.toFixed(0);
      pressHint = `${h.toFixed(0)}H ${a.toFixed(0)}A`;
      if (total <= 60) pressTone = 'green';
      else if (total <= 100) pressTone = 'amber';
      else pressTone = 'red';
    }
  }

  // ===== Indicador 2: Ataques Perigosos (5min) =====
  let daTone: Tone = 'muted';
  let daVal = '—';
  let daHint: string | undefined;
  if (l5) {
    const dh = l5.dangerous_attacks_home ?? 0;
    const da = l5.dangerous_attacks_away ?? 0;
    if (side === 'home' || side === 'away') {
      const our = side === 'home' ? dh : da;
      const opp = side === 'home' ? da : dh;
      const delta = our - opp;
      daVal = `${delta >= 0 ? '+' : ''}${delta}`;
      daHint = `${our}-${opp} (5')`;
      if (delta >= 3) daTone = 'green';
      else if (delta >= -2) daTone = 'amber';
      else daTone = 'red';
    } else if (side === 'totals') {
      const total = dh + da;
      daVal = String(total);
      daHint = `${dh}-${da} (5')`;
      if (total >= 8) daTone = 'green';
      else if (total >= 4) daTone = 'amber';
      else daTone = 'red';
    } else {
      const total = dh + da;
      daVal = String(total);
      daHint = `${dh}-${da} (5')`;
      if (total <= 3) daTone = 'green';
      else if (total <= 6) daTone = 'amber';
      else daTone = 'red';
    }
  }

  // ===== Indicador 3: Momentum (Δ chutes no gol 5' vs 5'-10') =====
  let mTone: Tone = 'muted';
  let mVal = '—';
  let mHint: string | undefined;
  let mDelta = 0;
  if (l5 && l10) {
    const s5h = l5.shots_on_target_home ?? 0;
    const s5a = l5.shots_on_target_away ?? 0;
    const s10h = l10.shots_on_target_home ?? 0;
    const s10a = l10.shots_on_target_away ?? 0;
    const prev5h = Math.max(0, s10h - s5h);
    const prev5a = Math.max(0, s10a - s5a);
    let cur = 0, prev = 0;
    if (side === 'home') { cur = s5h; prev = prev5h; }
    else if (side === 'away') { cur = s5a; prev = prev5a; }
    else { cur = s5h + s5a; prev = prev5h + prev5a; }

    mDelta = cur - prev;
    mVal = `${mDelta >= 0 ? '+' : ''}${mDelta}`;
    mHint = `${cur} vs ${prev} (anterior)`;

    if (side === 'defensive') {
      // queremos queda
      if (mDelta <= -1) mTone = 'green';
      else if (mDelta <= 1) mTone = 'amber';
      else mTone = 'red';
    } else {
      if (mDelta >= 1) mTone = 'green';
      else if (mDelta >= -1) mTone = 'amber';
      else mTone = 'red';
    }
  }

  return (
    <div className="mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/50 bg-[hsl(0,0%,7%)] px-2 py-1.5">
      <div className="flex items-center gap-1 mb-1">
        <Activity className="w-2.5 h-2.5 text-primary" />
        <span className="text-[8px] font-orbitron uppercase tracking-wider text-muted-foreground">
          Saúde do entrada • {market}
        </span>
      </div>
      <div className="flex gap-1.5">
        <Pill
          icon={<Flame className="w-2.5 h-2.5" />}
          label="Pressão"
          value={pressVal}
          tone={pressTone}
          hint={pressHint}
        />
        <Pill
          icon={<TrendingUp className="w-2.5 h-2.5" />}
          label="Ataques 5'"
          value={daVal}
          tone={daTone}
          hint={daHint}
        />
        <Pill
          icon={trendIcon(mDelta)}
          label="Momentum"
          value={mVal}
          tone={mTone}
          hint={mHint}
        />
      </div>
    </div>
  );
}
