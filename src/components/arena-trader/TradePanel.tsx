import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, X, Wallet, Shield, Target, Zap, RefreshCw, Hash, Percent } from 'lucide-react';
import type { Asset, TradePosition } from '@/pages/ArenaTrader';

interface TradePanelProps {
  balance: number;
  position: TradePosition | null;
  currentPrice: number;
  unrealizedPnl: number;
  onOpenPosition: (type: 'long' | 'short', amount: number, stopLoss?: number, takeProfit?: number, leverage?: number, partialConfig?: PartialExitConfig) => void;
  onClosePosition: () => void;
  onInvertPosition?: () => void;
  onPartialClose?: (percent: number) => void;
  asset: Asset;
}

export interface PartialExitConfig {
  enabled: boolean;
  tp1Percent: number; // % distance from entry for first target
  tp2Percent: number; // % distance from entry for second target
  tp1ClosePercent: number; // % of position to close at TP1 (e.g. 50)
}

const TRADE_AMOUNTS = [
  { label: '10K', value: 10000 },
  { label: '25K', value: 25000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
];

const CONTRACT_OPTIONS = [1, 2, 5, 10];
const LEVERAGE_OPTIONS = [1, 2, 5, 10];
const PARTIAL_OPTIONS = [25, 50, 75];

function FuturesContractSelector({ contracts, setContracts, pointValue, currentPrice }: {
  contracts: number; setContracts: (n: number) => void; pointValue: number; currentPrice: number;
}) {
  const totalExposure = contracts * currentPrice * pointValue;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Hash className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-bold text-white/60">Nº de Contratos</span>
        <span className="text-[10px] text-amber-400/70 ml-auto">
          Exposição: R$ {totalExposure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex gap-2">
        {CONTRACT_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setContracts(n)}
            className={`
              flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
              ${contracts === n
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                : 'bg-white/5 border border-white/10 text-white/50 hover:border-amber-500/30'
              }
            `}
          >
            {n}x
          </button>
        ))}
      </div>
      <div className="mt-1 text-[9px] text-white/30">
        Valor do ponto: R$ {pointValue.toFixed(2)}
      </div>
    </div>
  );
}

function PartialExitSelector({ config, onChange }: {
  config: PartialExitConfig;
  onChange: (c: PartialExitConfig) => void;
}) {
  return (
    <div className={`p-2.5 rounded-lg border transition-all ${config.enabled ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}>
      <button onClick={() => onChange({ ...config, enabled: !config.enabled })} className="flex items-center gap-1.5 w-full mb-1.5">
        <Percent className={`w-3.5 h-3.5 ${config.enabled ? 'text-cyan-400' : 'text-white/30'}`} />
        <span className={`text-xs font-bold ${config.enabled ? 'text-cyan-400' : 'text-white/40'}`}>Saída Parcial</span>
      </button>
      {config.enabled && (
        <div className="space-y-2">
          {/* TP1 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/50">Alvo 1 (TP1)</span>
              <span className="text-[10px] font-bold text-emerald-400">+{config.tp1Percent}%</span>
            </div>
            <input
              type="range" min="0.5" max="5" step="0.5"
              value={config.tp1Percent} onChange={(e) => onChange({ ...config, tp1Percent: +e.target.value })}
              className="w-full h-1 accent-emerald-500"
            />
          </div>
          {/* Close % at TP1 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/50">Fechar no TP1</span>
            </div>
            <div className="flex gap-1.5">
              {PARTIAL_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => onChange({ ...config, tp1ClosePercent: pct })}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                    config.tp1ClosePercent === pct
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:border-cyan-500/30'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          {/* TP2 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/50">Alvo 2 (TP2) — resto</span>
              <span className="text-[10px] font-bold text-emerald-400">+{config.tp2Percent}%</span>
            </div>
            <input
              type="range" min="1" max="15" step="0.5"
              value={config.tp2Percent} onChange={(e) => onChange({ ...config, tp2Percent: Math.max(+e.target.value, config.tp1Percent + 0.5) })}
              className="w-full h-1 accent-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradePanel({ balance, position, currentPrice, unrealizedPnl, onOpenPosition, onClosePosition, onInvertPosition, onPartialClose, asset }: TradePanelProps) {
  const [selectedAmount, setSelectedAmount] = useState(25000);
  // SL is now always enabled by default
  const [slPercent, setSlPercent] = useState(3);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [tpPercent, setTpPercent] = useState(5);
  const [leverage, setLeverage] = useState(1);
  const [contracts, setContracts] = useState(1);
  const [partialConfig, setPartialConfig] = useState<PartialExitConfig>({
    enabled: false,
    tp1Percent: 2,
    tp2Percent: 5,
    tp1ClosePercent: 50,
  });

  const isFutures = asset.category === 'futures';

  const futuresMargin = isFutures ? Math.floor(contracts * currentPrice * (asset.pointValue || 1) * 0.15) : 0;
  const effectiveAmount = isFutures ? Math.max(futuresMargin, 5000) : selectedAmount;

  // SL is always computed (auto)
  const computeSL = () => +(currentPrice * (1 - slPercent / 100)).toFixed(2);
  const computeShortSL = () => +(currentPrice * (1 + slPercent / 100)).toFixed(2);

  // TP uses partialConfig TP2 if partial enabled, else simple TP
  const computeTP = () => {
    if (partialConfig.enabled) return +(currentPrice * (1 + partialConfig.tp2Percent / 100)).toFixed(2);
    return tpEnabled ? +(currentPrice * (1 + tpPercent / 100)).toFixed(2) : undefined;
  };
  const computeShortTP = () => {
    if (partialConfig.enabled) return +(currentPrice * (1 - partialConfig.tp2Percent / 100)).toFixed(2);
    return tpEnabled ? +(currentPrice * (1 - tpPercent / 100)).toFixed(2) : undefined;
  };

  const liquidationPrice = leverage > 1
    ? +(currentPrice * (1 - 1 / leverage)).toFixed(2)
    : null;

  if (position) {
    const pnlPercent = ((unrealizedPnl / position.amount) * 100).toFixed(2);
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 bg-[#111111] border border-amber-900/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              position.type === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {position.type === 'long' ? 'LONG' : 'SHORT'}
            </span>
            <span className="font-orbitron text-sm text-white">{position.asset.symbol}</span>
            {position.leverage && position.leverage > 1 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {position.leverage}x
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40">Entrada: R$ {position.entryPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-white/40">Volume: {position.amount.toLocaleString()} BC</div>
          </div>
        </div>

        {/* SL/TP levels display */}
        <div className="flex gap-2 mb-3">
          {position.stopLoss && (
            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5 text-center">
              <div className="text-[9px] text-red-400/60">Stop Loss</div>
              <div className="text-xs font-mono font-bold text-red-400">
                R$ {position.stopLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
          {position.takeProfit && (
            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5 text-center">
              <div className="text-[9px] text-emerald-400/60">Take Profit</div>
              <div className="text-xs font-mono font-bold text-emerald-400">
                R$ {position.takeProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-white/40">P&L Não-Realizado</div>
            <div className={`font-orbitron text-xl font-bold ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toLocaleString()} BC
            </div>
            <div className={`text-xs ${unrealizedPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              ({unrealizedPnl >= 0 ? '+' : ''}{pnlPercent}%)
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Partial close buttons */}
            {onPartialClose && (
              <div className="flex gap-1">
                {PARTIAL_OPTIONS.map((pct) => (
                  <motion.button
                    key={pct}
                    onClick={() => onPartialClose(pct)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-2 py-2 bg-cyan-600/20 hover:bg-cyan-500/30 text-cyan-400 font-orbitron font-bold text-[9px] rounded-lg transition-colors border border-cyan-500/20"
                    title={`Fechar ${pct}% da posição`}
                  >
                    {pct}%
                  </motion.button>
                ))}
              </div>
            )}
            {isFutures && onInvertPosition && (
              <motion.button
                onClick={onInvertPosition}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-3 bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-bold text-[10px] rounded-xl transition-colors flex items-center gap-1.5"
                title="Inverter Posição"
              >
                <RefreshCw className="w-4 h-4" />
                INVERTER
              </motion.button>
            )}
            <motion.button
              onClick={onClosePosition}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-orbitron font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              FECHAR
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mt-3 bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      {/* Futures: Contract selector */}
      {isFutures ? (
        <FuturesContractSelector
          contracts={contracts}
          setContracts={setContracts}
          pointValue={asset.pointValue || 1}
          currentPrice={currentPrice}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400/60" />
              <span className="text-xs text-white/40">Volume da operação:</span>
            </div>
            <span className="font-orbitron text-xs text-amber-400">{selectedAmount.toLocaleString()} BC</span>
          </div>

          <div className="flex gap-2 mb-3">
            {TRADE_AMOUNTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedAmount(opt.value)}
                disabled={opt.value > balance}
                className={`
                  flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${selectedAmount === opt.value
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:border-amber-500/30'
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Leverage selector (non-futures only) */}
      {!isFutures && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className={`w-3.5 h-3.5 ${leverage > 1 ? 'text-amber-400' : 'text-white/30'}`} />
            <span className="text-xs font-bold text-white/60">Alavancagem</span>
            {leverage > 1 && (
              <span className="text-[10px] text-amber-400/70 ml-auto">
                ⚠ Liq. ~R$ {liquidationPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                className={`
                  flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${leverage === lev
                    ? lev >= 5
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:border-amber-500/30'
                  }
                `}
              >
                {lev}x
              </button>
            ))}
          </div>
          {leverage >= 5 && (
            <p className="text-[10px] text-red-400/70 mt-1.5 italic">
              ⚡ Alavancagem alta — risco exponencial de liquidação forçada
            </p>
          )}
        </div>
      )}

      {/* SL (always active) + TP Controls */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Stop Loss — always active */}
        <div className="p-2.5 rounded-lg border bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-red-400">Stop Loss (auto)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range" min="1" max={isFutures ? 2 : 10} step="0.5"
              value={slPercent} onChange={(e) => setSlPercent(+e.target.value)}
              className="flex-1 h-1 accent-red-500"
            />
            <span className="text-xs font-bold text-red-400 w-8 text-right">-{slPercent}%</span>
          </div>
          <div className="text-[9px] text-red-400/50 mt-1">
            SL: R$ {(currentPrice * (1 - slPercent / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Take Profit — optional simple mode */}
        <div className={`p-2.5 rounded-lg border transition-all ${tpEnabled && !partialConfig.enabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
          <button onClick={() => { setTpEnabled(!tpEnabled); if (partialConfig.enabled) setPartialConfig(p => ({ ...p, enabled: false })); }} className="flex items-center gap-1.5 w-full mb-1.5">
            <Target className={`w-3.5 h-3.5 ${tpEnabled && !partialConfig.enabled ? 'text-emerald-400' : 'text-white/30'}`} />
            <span className={`text-xs font-bold ${tpEnabled && !partialConfig.enabled ? 'text-emerald-400' : 'text-white/40'}`}>Take Profit</span>
          </button>
          {tpEnabled && !partialConfig.enabled && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="range" min="1" max="20" step="0.5"
                  value={tpPercent} onChange={(e) => setTpPercent(+e.target.value)}
                  className="flex-1 h-1 accent-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-400 w-8 text-right">+{tpPercent}%</span>
              </div>
              <div className="text-[9px] text-emerald-400/50 mt-1">
                TP: R$ {(currentPrice * (1 + tpPercent / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Partial Exit / Multi-target system */}
      <div className="mb-4">
        <PartialExitSelector config={partialConfig} onChange={(c) => { setPartialConfig(c); if (c.enabled) setTpEnabled(false); }} />
      </div>

      {/* Buy/Sell buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => onOpenPosition('long', effectiveAmount, computeSL(), computeTP(), isFutures ? 1 : leverage, partialConfig.enabled ? partialConfig : undefined)}
          disabled={effectiveAmount > balance}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            py-3 rounded-xl font-orbitron font-bold text-sm
            bg-gradient-to-b from-emerald-500 to-emerald-700
            hover:from-emerald-400 hover:to-emerald-600
            text-white shadow-lg shadow-emerald-500/20
            flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all
          "
        >
          <TrendingUp className="w-5 h-5" />
          COMPRAR
        </motion.button>

        <motion.button
          onClick={() => onOpenPosition('short', effectiveAmount, computeShortSL(), computeShortTP(), isFutures ? 1 : leverage, partialConfig.enabled ? partialConfig : undefined)}
          disabled={effectiveAmount > balance}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            py-3 rounded-xl font-orbitron font-bold text-sm
            bg-gradient-to-b from-red-500 to-red-700
            hover:from-red-400 hover:to-red-600
            text-white shadow-lg shadow-red-500/20
            flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all
          "
        >
          <TrendingDown className="w-5 h-5" />
          VENDER
        </motion.button>
      </div>
    </div>
  );
}
