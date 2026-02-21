import { useMemo } from 'react';
import type { Candle, Asset, TradePosition } from '@/pages/ArenaTrader';
import { calculateSMA, calculateBollingerBands, calculateRSI } from '@/lib/technicalIndicators';

interface CandlestickChartProps {
  candles: Candle[];
  asset: Asset;
  position: TradePosition | null;
  support?: number;
  resistance?: number;
  stopLoss?: number;
  takeProfit?: number;
  indicators?: {
    sma9: boolean;
    sma21: boolean;
    bollinger: boolean;
    rsi: boolean;
  };
}

export default function CandlestickChart({ candles, asset, position, support, resistance, stopLoss, takeProfit, indicators }: CandlestickChartProps) {
  const showRSI = indicators?.rsi;
  const mainHeight = showRSI ? 310 : 400;
  const rsiHeight = 80;
  const totalHeight = showRSI ? mainHeight + rsiHeight + 10 : mainHeight;

  const { bars, yMin, yMax, width } = useMemo(() => {
    if (candles.length === 0) return { bars: [], yMin: 0, yMax: 0, width: 800 };

    const w = 800;
    const pad = 60;
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const min = Math.min(...allPrices) * 0.998;
    const max = Math.max(...allPrices) * 1.002;
    const barWidth = Math.max(4, (w - pad * 2) / candles.length - 2);

    const mapped = candles.map((c, i) => {
      const x = pad + i * ((w - pad * 2) / candles.length) + barWidth / 2;
      const toY = (price: number) => mainHeight - pad - ((price - min) / (max - min)) * (mainHeight - pad * 2);
      const isGreen = c.close >= c.open;

      return { x, openY: toY(c.open), closeY: toY(c.close), highY: toY(c.high), lowY: toY(c.low), isGreen, barWidth, candle: c };
    });

    return { bars: mapped, yMin: min, yMax: max, width: w };
  }, [candles, mainHeight]);

  const toY = (price: number) => {
    const pad = 60;
    return mainHeight - pad - ((price - yMin) / (yMax - yMin)) * (mainHeight - pad * 2);
  };

  const formatPrice = (p: number) => asset.category === 'crypto' ? p.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : p.toFixed(2);

  const yLabels = useMemo(() => {
    const count = 6;
    const labels = [];
    for (let i = 0; i <= count; i++) {
      const price = yMin + (yMax - yMin) * (i / count);
      labels.push({ price, y: toY(price) });
    }
    return labels;
  }, [yMin, yMax]);

  // Technical indicators
  const sma9 = useMemo(() => indicators?.sma9 ? calculateSMA(candles, 9) : [], [candles, indicators?.sma9]);
  const sma21 = useMemo(() => indicators?.sma21 ? calculateSMA(candles, 21) : [], [candles, indicators?.sma21]);
  const bollinger = useMemo(() => indicators?.bollinger ? calculateBollingerBands(candles) : [], [candles, indicators?.bollinger]);
  const rsiValues = useMemo(() => indicators?.rsi ? calculateRSI(candles) : [], [candles, indicators?.rsi]);

  const buildLinePath = (values: (number | null)[]) => {
    let path = '';
    values.forEach((val, i) => {
      if (val === null || i >= bars.length) return;
      const y = toY(val);
      path += path === '' ? `M ${bars[i].x} ${y}` : ` L ${bars[i].x} ${y}`;
    });
    return path;
  };

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  return (
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="font-orbitron text-sm font-bold text-amber-400">{asset.symbol}</span>
        <span className="font-orbitron text-lg font-bold text-white">
          R$ {formatPrice(lastPrice)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full h-[calc(100%-30px)]" preserveAspectRatio="none">
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1="60" y1={l.y} x2={width - 10} y2={l.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x="55" y={l.y + 4} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="end" fontFamily="monospace">
              {formatPrice(l.price)}
            </text>
          </g>
        ))}

        {/* Bollinger Bands */}
        {indicators?.bollinger && bollinger.length > 0 && (() => {
          let upperPath = '';
          let lowerPath = '';
          bollinger.forEach((b, i) => {
            if (!b.upper || !b.lower || i >= bars.length) return;
            const cmd = upperPath === '' ? 'M' : 'L';
            upperPath += `${cmd} ${bars[i].x} ${toY(b.upper)} `;
            lowerPath += `${cmd} ${bars[i].x} ${toY(b.lower)} `;
          });
          // Fill area
          const lowerReversed = bollinger
            .map((b, i) => b.lower && i < bars.length ? `${bars[i].x} ${toY(b.lower)}` : null)
            .filter(Boolean)
            .reverse()
            .join(' L ');
          const fillPath = upperPath && lowerReversed ? `${upperPath} L ${lowerReversed} Z` : '';

          return (
            <>
              {fillPath && <path d={fillPath} fill="rgba(139,92,246,0.06)" />}
              <path d={upperPath} fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
              <path d={lowerPath} fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
            </>
          );
        })()}

        {/* SMA lines */}
        {indicators?.sma9 && sma9.length > 0 && (
          <path d={buildLinePath(sma9)} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.8" />
        )}
        {indicators?.sma21 && sma21.length > 0 && (
          <path d={buildLinePath(sma21)} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
        )}

        {/* Support line */}
        {support && support >= yMin && support <= yMax && (
          <>
            <line x1="60" y1={toY(support)} x2={width - 10} y2={toY(support)} stroke="#10b981" strokeWidth="1" strokeDasharray="6,4" opacity="0.6" />
            <text x={width - 8} y={toY(support) - 4} fill="#10b981" fontSize="9" textAnchor="end" fontFamily="monospace">S: {formatPrice(support)}</text>
          </>
        )}

        {/* Resistance line */}
        {resistance && resistance >= yMin && resistance <= yMax && (
          <>
            <line x1="60" y1={toY(resistance)} x2={width - 10} y2={toY(resistance)} stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" opacity="0.6" />
            <text x={width - 8} y={toY(resistance) - 4} fill="#ef4444" fontSize="9" textAnchor="end" fontFamily="monospace">R: {formatPrice(resistance)}</text>
          </>
        )}

        {/* Stop Loss line */}
        {stopLoss && stopLoss >= yMin && stopLoss <= yMax && (
          <>
            <line x1="60" y1={toY(stopLoss)} x2={width - 10} y2={toY(stopLoss)} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="8,4" opacity="0.8" />
            <rect x={width - 90} y={toY(stopLoss) - 12} width="82" height="16" rx="3" fill="#f43f5e" opacity="0.2" />
            <text x={width - 8} y={toY(stopLoss) + 1} fill="#f43f5e" fontSize="9" textAnchor="end" fontFamily="monospace" fontWeight="bold">
              SL: {formatPrice(stopLoss)}
            </text>
          </>
        )}

        {/* Take Profit line */}
        {takeProfit && takeProfit >= yMin && takeProfit <= yMax && (
          <>
            <line x1="60" y1={toY(takeProfit)} x2={width - 10} y2={toY(takeProfit)} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="8,4" opacity="0.8" />
            <rect x={width - 90} y={toY(takeProfit) - 12} width="82" height="16" rx="3" fill="#22c55e" opacity="0.2" />
            <text x={width - 8} y={toY(takeProfit) + 1} fill="#22c55e" fontSize="9" textAnchor="end" fontFamily="monospace" fontWeight="bold">
              TP: {formatPrice(takeProfit)}
            </text>
          </>
        )}

        {/* Entry price line */}
        {position && position.entryPrice >= yMin && position.entryPrice <= yMax && (
          <>
            <line x1="60" y1={toY(position.entryPrice)} x2={width - 10} y2={toY(position.entryPrice)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.8" />
            <text x={width - 8} y={toY(position.entryPrice) - 4} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="monospace">
              Entrada: {formatPrice(position.entryPrice)}
            </text>
          </>
        )}

        {/* Candlesticks */}
        {bars.map((bar, i) => (
          <g key={i}>
            <line x1={bar.x} y1={bar.highY} x2={bar.x} y2={bar.lowY} stroke={bar.isGreen ? '#10b981' : '#ef4444'} strokeWidth="1" opacity="0.7" />
            <rect
              x={bar.x - bar.barWidth / 2}
              y={Math.min(bar.openY, bar.closeY)}
              width={bar.barWidth}
              height={Math.max(1, Math.abs(bar.closeY - bar.openY))}
              fill={bar.isGreen ? '#10b981' : '#ef4444'}
              rx="1"
            />
          </g>
        ))}

        {/* Current price indicator */}
        {candles.length > 0 && (
          <circle cx={width - 20} cy={toY(lastPrice)} r="4" fill="#f59e0b">
            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* RSI Sub-chart */}
        {showRSI && bars.length > 0 && (() => {
          const rsiTop = mainHeight + 10;
          const rsiBot = rsiTop + rsiHeight;
          const rsiToY = (val: number) => rsiBot - ((val / 100) * rsiHeight);

          let rsiPath = '';
          rsiValues.forEach((val, i) => {
            if (val === null || i >= bars.length) return;
            rsiPath += rsiPath === '' ? `M ${bars[i].x} ${rsiToY(val)}` : ` L ${bars[i].x} ${rsiToY(val)}`;
          });

          return (
            <g>
              {/* RSI background */}
              <rect x="60" y={rsiTop} width={width - 70} height={rsiHeight} fill="rgba(255,255,255,0.02)" rx="4" />
              {/* Overbought/Oversold zones */}
              <rect x="60" y={rsiToY(70)} width={width - 70} height={rsiToY(30) - rsiToY(70)} fill="rgba(6,182,212,0.05)" />
              <line x1="60" y1={rsiToY(70)} x2={width - 10} y2={rsiToY(70)} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
              <line x1="60" y1={rsiToY(30)} x2={width - 10} y2={rsiToY(30)} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
              <text x="55" y={rsiToY(70) + 3} fill="rgba(6,182,212,0.5)" fontSize="8" textAnchor="end" fontFamily="monospace">70</text>
              <text x="55" y={rsiToY(30) + 3} fill="rgba(6,182,212,0.5)" fontSize="8" textAnchor="end" fontFamily="monospace">30</text>
              <text x="55" y={rsiToY(50) + 3} fill="rgba(255,255,255,0.2)" fontSize="8" textAnchor="end" fontFamily="monospace">50</text>
              <text x="62" y={rsiTop - 2} fill="rgba(6,182,212,0.6)" fontSize="9" fontFamily="monospace" fontWeight="bold">RSI(14)</text>
              {/* RSI line */}
              <path d={rsiPath} fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.9" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
