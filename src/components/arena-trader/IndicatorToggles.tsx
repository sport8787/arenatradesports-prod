interface IndicatorTogglesProps {
  indicators: {
    sma9: boolean;
    sma21: boolean;
    bollinger: boolean;
    rsi: boolean;
  };
  onToggle: (key: 'sma9' | 'sma21' | 'bollinger' | 'rsi') => void;
}

const INDICATOR_CONFIG = [
  { key: 'sma9' as const, label: 'SMA 9', color: '#3b82f6' },
  { key: 'sma21' as const, label: 'SMA 21', color: '#f59e0b' },
  { key: 'bollinger' as const, label: 'Bollinger', color: '#8b5cf6' },
  { key: 'rsi' as const, label: 'RSI', color: '#06b6d4' },
];

export default function IndicatorToggles({ indicators, onToggle }: IndicatorTogglesProps) {
  return (
    <div className="flex items-center gap-1.5">
      {INDICATOR_CONFIG.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={`
            px-2 py-1 rounded text-[10px] font-bold transition-all border
            ${indicators[key]
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-white/5 border-white/5 text-white/30 hover:border-white/15'
            }
          `}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: indicators[key] ? color : 'rgba(255,255,255,0.2)' }} />
          {label}
        </button>
      ))}
    </div>
  );
}
