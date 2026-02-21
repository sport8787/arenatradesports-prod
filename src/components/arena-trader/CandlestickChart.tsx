import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which candle index the position was opened on
  const entryIndexRef = useRef<number | null>(null);
  const prevPositionRef = useRef<TradePosition | null>(null);

  useEffect(() => {
    if (position && !prevPositionRef.current) {
      // Position just opened — mark current candle
      entryIndexRef.current = candles.length - 1;
    } else if (!position && prevPositionRef.current) {
      // Position closed — clear
      entryIndexRef.current = null;
    }
    prevPositionRef.current = position;
  }, [position, candles.length]);

  const handleZoomIn = useCallback(() => setZoomLevel(z => Math.min(z + 0.3, 4)), []);
  const handleZoomOut = useCallback(() => setZoomLevel(z => Math.max(z - 0.3, 0.5)), []);

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomLevel(z => {
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        return Math.min(4, Math.max(0.5, z + delta));
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const showRSI = indicators?.rsi;
  const mainHeight = showRSI ? 310 : 400;
  const rsiHeight = 80;
  const totalHeight = showRSI ? mainHeight + rsiHeight + 10 : mainHeight;

  // Zoom: show fewer candles when zoomed in
  const visibleCandles = useMemo(() => {
    const maxVisible = Math.max(10, Math.round(candles.length / zoomLevel));
    if (candles.length <= maxVisible) return candles;
    return candles.slice(candles.length - maxVisible);
  }, [candles, zoomLevel]);

  const candleOffset = candles.length - visibleCandles.length;

  const { bars, yMin, yMax, width } = useMemo(() => {
    if (visibleCandles.length === 0) return { bars: [], yMin: 0, yMax: 0, width: 800 };

    const w = 800;
    const pad = 60;
    const allPrices = visibleCandles.flatMap(c => [c.high, c.low]);
    const min = Math.min(...allPrices) * 0.998;
    const max = Math.max(...allPrices) * 1.002;
    const barWidth = Math.max(4, (w - pad * 2) / visibleCandles.length - 2);

    const mapped = visibleCandles.map((c, i) => {
      const x = pad + i * ((w - pad * 2) / visibleCandles.length) + barWidth / 2;
      const toY = (price: number) => mainHeight - pad - ((price - min) / (max - min)) * (mainHeight - pad * 2);
      const isGreen = c.close >= c.open;

      return { x, openY: toY(c.open), closeY: toY(c.close), highY: toY(c.high), lowY: toY(c.low), isGreen, barWidth, candle: c };
    });

    return { bars: mapped, yMin: min, yMax: max, width: w };
  }, [visibleCandles, mainHeight]);

  const toY = (price: number) => {
    const pad = 60;
    return mainHeight - pad - ((price - yMin) / (yMax - yMin)) * (mainHeight - pad * 2);
  };

  const formatPrice = (p: number) => asset.category === 'crypto' ? p.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : asset.category === 'futures' ? p.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : p.toFixed(2);

  // Milhar lines for futures
  const milharLines = useMemo(() => {
    if (asset.category !== 'futures') return [];
    const step = asset.symbol === 'WIN' ? 1000 : 50;
    const lines: number[] = [];
    const startMilhar = Math.floor(yMin / step) * step;
    for (let m = startMilhar; m <= yMax; m += step) {
      if (m >= yMin && m <= yMax) lines.push(m);
    }
    return lines;
  }, [asset, yMin, yMax]);

  const yLabels = useMemo(() => {
    const count = 6;
    const labels = [];
    for (let i = 0; i <= count; i++) {
      const price = yMin + (yMax - yMin) * (i / count);
      labels.push({ price, y: toY(price) });
    }
    return labels;
  }, [yMin, yMax]);

  // Technical indicators (use visibleCandles for correct alignment)
  const sma9 = useMemo(() => indicators?.sma9 ? calculateSMA(candles, 9).slice(candleOffset) : [], [candles, indicators?.sma9, candleOffset]);
  const sma21 = useMemo(() => indicators?.sma21 ? calculateSMA(candles, 21).slice(candleOffset) : [], [candles, indicators?.sma21, candleOffset]);
  const bollinger = useMemo(() => indicators?.bollinger ? calculateBollingerBands(candles).slice(candleOffset) : [], [candles, indicators?.bollinger, candleOffset]);
  const rsiValues = useMemo(() => indicators?.rsi ? calculateRSI(candles).slice(candleOffset) : [], [candles, indicators?.rsi, candleOffset]);

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

  // Entry marker bar index (adjusted for visible range)
  const entryBarIndex = entryIndexRef.current !== null ? entryIndexRef.current - candleOffset : null;
  const showEntryMarker = position && entryBarIndex !== null && entryBarIndex >= 0 && entryBarIndex < bars.length;

  return (
    <div className="w-full h-full" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-orbitron text-sm font-bold text-amber-400">{asset.symbol}</span>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-black/40 rounded-lg border border-amber-900/30 p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-white/10 transition-colors text-amber-400/70 hover:text-amber-400"
              title="Zoom out (Ctrl + Scroll ↓)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] text-white/40 font-mono min-w-[28px] text-center">{zoomLevel.toFixed(1)}x</span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-white/10 transition-colors text-amber-400/70 hover:text-amber-400"
              title="Zoom in (Ctrl + Scroll ↑)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="font-orbitron text-lg font-bold text-white">
            R$ {formatPrice(lastPrice)}
          </span>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${width} ${totalHeight}`} className="w-full h-[calc(100%-30px)]" preserveAspectRatio="none">
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1="60" y1={l.y} x2={width - 10} y2={l.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x="55" y={l.y + 4} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="end" fontFamily="monospace">
              {formatPrice(l.price)}
            </text>
          </g>
        ))}

        {/* Milhar Lines (futures only) */}
        {milharLines.map((m, i) => (
          <g key={`milhar-${i}`}>
            <line x1="60" y1={toY(m)} x2={width - 10} y2={toY(m)} stroke="rgba(245,158,11,0.25)" strokeWidth="1.5" strokeDasharray="8,6" />
            <text x={width - 8} y={toY(m) - 3} fill="rgba(245,158,11,0.5)" fontSize="8" textAnchor="end" fontFamily="monospace" fontWeight="bold">
              {m.toLocaleString('pt-BR')}
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

        {/* ═══ ENTRY MARKER on candle (like Profit) ═══ */}
        {showEntryMarker && (() => {
          const bar = bars[entryBarIndex!];
          const isLong = position!.type === 'long';
          const markerY = isLong ? bar.lowY + 12 : bar.highY - 12;
          const arrowColor = isLong ? '#22c55e' : '#ef4444';
          const arrowLabel = isLong ? 'C' : 'V';
          // Triangle pointing up (buy) or down (sell)
          const triPoints = isLong
            ? `${bar.x},${markerY - 8} ${bar.x - 6},${markerY + 2} ${bar.x + 6},${markerY + 2}`
            : `${bar.x},${markerY + 8} ${bar.x - 6},${markerY - 2} ${bar.x + 6},${markerY - 2}`;

          return (
            <g>
              {/* Entry arrow */}
              <polygon points={triPoints} fill={arrowColor} opacity="0.9" />
              <text x={bar.x} y={isLong ? markerY + 14 : markerY - 10} fill={arrowColor} fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                {arrowLabel}
              </text>

              {/* Dashed vertical line from entry to SL/TP zone */}
              <line x1={bar.x} y1={bar.highY} x2={bar.x} y2={bar.lowY} stroke={arrowColor} strokeWidth="1" strokeDasharray="2,2" opacity="0.3" />

              {/* SL target marker (small horizontal dash at SL price) */}
              {stopLoss && stopLoss >= yMin && stopLoss <= yMax && (
                <g>
                  <line x1={bar.x - 10} y1={toY(stopLoss)} x2={bar.x + 10} y2={toY(stopLoss)} stroke="#f43f5e" strokeWidth="2" opacity="0.8" />
                  <circle cx={bar.x} cy={toY(stopLoss)} r="3" fill="#f43f5e" opacity="0.6" />
                </g>
              )}

              {/* TP target marker */}
              {takeProfit && takeProfit >= yMin && takeProfit <= yMax && (
                <g>
                  <line x1={bar.x - 10} y1={toY(takeProfit)} x2={bar.x + 10} y2={toY(takeProfit)} stroke="#22c55e" strokeWidth="2" opacity="0.8" />
                  <circle cx={bar.x} cy={toY(takeProfit)} r="3" fill="#22c55e" opacity="0.6" />
                </g>
              )}

              {/* Connecting line from entry to SL and TP */}
              {stopLoss && stopLoss >= yMin && stopLoss <= yMax && (
                <line x1={bar.x} y1={toY(position!.entryPrice)} x2={bar.x} y2={toY(stopLoss)} stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
              )}
              {takeProfit && takeProfit >= yMin && takeProfit <= yMax && (
                <line x1={bar.x} y1={toY(position!.entryPrice)} x2={bar.x} y2={toY(takeProfit)} stroke="#22c55e" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
              )}

              {/* Shaded R:R zone (entry to TP green, entry to SL red) */}
              {takeProfit && takeProfit >= yMin && takeProfit <= yMax && (
                <rect
                  x={bar.x - 8}
                  y={Math.min(toY(position!.entryPrice), toY(takeProfit))}
                  width="16"
                  height={Math.abs(toY(position!.entryPrice) - toY(takeProfit))}
                  fill="#22c55e"
                  opacity="0.06"
                  rx="2"
                />
              )}
              {stopLoss && stopLoss >= yMin && stopLoss <= yMax && (
                <rect
                  x={bar.x - 8}
                  y={Math.min(toY(position!.entryPrice), toY(stopLoss))}
                  width="16"
                  height={Math.abs(toY(position!.entryPrice) - toY(stopLoss))}
                  fill="#f43f5e"
                  opacity="0.06"
                  rx="2"
                />
              )}
            </g>
          );
        })()}

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
              <rect x="60" y={rsiTop} width={width - 70} height={rsiHeight} fill="rgba(255,255,255,0.02)" rx="4" />
              <rect x="60" y={rsiToY(70)} width={width - 70} height={rsiToY(30) - rsiToY(70)} fill="rgba(6,182,212,0.05)" />
              <line x1="60" y1={rsiToY(70)} x2={width - 10} y2={rsiToY(70)} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
              <line x1="60" y1={rsiToY(30)} x2={width - 10} y2={rsiToY(30)} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
              <text x="55" y={rsiToY(70) + 3} fill="rgba(6,182,212,0.5)" fontSize="8" textAnchor="end" fontFamily="monospace">70</text>
              <text x="55" y={rsiToY(30) + 3} fill="rgba(6,182,212,0.5)" fontSize="8" textAnchor="end" fontFamily="monospace">30</text>
              <text x="55" y={rsiToY(50) + 3} fill="rgba(255,255,255,0.2)" fontSize="8" textAnchor="end" fontFamily="monospace">50</text>
              <text x="62" y={rsiTop - 2} fill="rgba(6,182,212,0.6)" fontSize="9" fontFamily="monospace" fontWeight="bold">RSI(14)</text>
              <path d={rsiPath} fill="none" stroke="#06b6d4" strokeWidth="1.5" opacity="0.9" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
