import { Pause, Play, Gauge } from 'lucide-react';

interface SimulationControlsProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  paused: boolean;
  onTogglePause: () => void;
}

const SPEED_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
];

export default function SimulationControls({ speed, onSpeedChange, paused, onTogglePause }: SimulationControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onTogglePause}
        className={`p-1.5 rounded-lg border transition-all ${
          paused
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            : 'bg-white/5 border-white/10 text-white/50 hover:border-amber-500/30'
        }`}
        title={paused ? 'Retomar' : 'Pausar'}
      >
        {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </button>

      <div className="flex items-center gap-1">
        <Gauge className="w-3.5 h-3.5 text-white/30" />
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSpeedChange(opt.value)}
            className={`
              px-2 py-1 rounded text-[10px] font-bold transition-all
              ${speed === opt.value
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                : 'bg-white/5 border border-white/10 text-white/40 hover:border-amber-500/30'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {paused && (
        <span className="text-[10px] text-amber-400/60 font-bold uppercase tracking-wider animate-pulse">
          PAUSADO
        </span>
      )}
    </div>
  );
}
