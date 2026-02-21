import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, RefreshCw, Shield, Target, AlertTriangle, TrendingUp, TrendingDown, Eye, History, ChevronDown, ChevronUp } from 'lucide-react';
import type { Asset } from '@/pages/ArenaTrader';

interface PredictionRecord {
  timestamp: number;
  asset: string;
  prediction: string;
  priceAtPrediction: number;
  currentPrice?: number;
  correct?: boolean;
}

interface MycroftTraderPanelProps {
  analysis: {
    support: number;
    resistance: number;
    trend: string;
    verdict: string;
    riskLevel: number;
    statusMercado?: string;
    alertaEstresse?: string;
    volumeReal?: number;
    volumeBurburinho?: number;
    blefeDeMercado?: boolean;
    recomendacaoAporte?: string;
  } | null;
  isAnalyzing: boolean;
  onRequestAnalysis: () => void;
  asset: Asset;
  predictionHistory?: PredictionRecord[];
}

export default function MycroftTraderPanel({ analysis, isAnalyzing, onRequestAnalysis, asset, predictionHistory = [] }: MycroftTraderPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="bg-[#111111] border border-cyan-900/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-orbitron text-xs font-bold text-cyan-400 uppercase">Mycroft Trader</h3>
            <p className="text-[10px] text-cyan-400/50">Relatório Forense</p>
          </div>
        </div>
        <button
          onClick={onRequestAnalysis}
          disabled={isAnalyzing}
          className="p-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-cyan-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isAnalyzing ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-cyan-500/10 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
          ))}
          <p className="text-xs text-cyan-400/50 text-center mt-3">Analisando {asset.symbol}...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          {/* Support & Resistance */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400/70 uppercase">Suporte</span>
              </div>
              <span className="font-orbitron text-sm font-bold text-emerald-400">
                {analysis.support.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <Target className="w-3 h-3 text-red-400" />
                <span className="text-[10px] text-red-400/70 uppercase">Resistência</span>
              </div>
              <span className="font-orbitron text-sm font-bold text-red-400">
                {analysis.resistance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Market Bluff Detection */}
          {analysis.blefeDeMercado !== undefined && (
            <div className={`rounded-lg p-2.5 border ${
              analysis.blefeDeMercado
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-400 uppercase">Detecção de Blefe de Mercado</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${analysis.blefeDeMercado ? 'text-red-400' : 'text-emerald-400'}`}>
                  {analysis.blefeDeMercado ? '⚠️ BLEFE DETECTADO' : '✅ Movimento Legítimo'}
                </span>
              </div>
              {/* Volume bars */}
              {analysis.volumeReal !== undefined && analysis.volumeBurburinho !== undefined && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 w-16">Vol. Real</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${analysis.volumeReal}%` }} />
                    </div>
                    <span className="text-[9px] text-emerald-400">{analysis.volumeReal}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 w-16">Burburinho</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400/60 rounded-full" style={{ width: `${analysis.volumeBurburinho}%` }} />
                    </div>
                    <span className="text-[9px] text-red-400">{analysis.volumeBurburinho}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status & Trend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase">Tendência:</span>
              <span className={`text-xs font-bold flex items-center gap-1 ${analysis.trend === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                {analysis.trend === 'bullish' ? <><TrendingUp className="w-3 h-3" /> Altista</> : <><TrendingDown className="w-3 h-3" /> Baixista</>}
              </span>
            </div>
            {analysis.statusMercado && (
              <span className={`text-[10px] font-orbitron font-bold px-2 py-0.5 rounded ${
                analysis.statusMercado === 'BUY THE DIP' ? 'bg-emerald-500/20 text-emerald-400' :
                analysis.statusMercado === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                analysis.statusMercado === 'SELL' ? 'bg-orange-500/20 text-orange-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {analysis.statusMercado}
              </span>
            )}
          </div>

          {/* Recommended position size */}
          {analysis.recomendacaoAporte && (
            <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-2">
              <span className="text-[10px] text-cyan-400/70 uppercase">Aporte Recomendado</span>
              <p className="text-xs text-cyan-300 mt-0.5">{analysis.recomendacaoAporte}</p>
            </div>
          )}

          {/* Risk Level */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Risco
              </span>
              <span className="text-[10px] text-amber-400">{analysis.riskLevel}/10</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${analysis.riskLevel * 10}%` }}
                className={`h-full rounded-full ${
                  analysis.riskLevel <= 3 ? 'bg-emerald-400' :
                  analysis.riskLevel <= 6 ? 'bg-amber-400' : 'bg-red-400'
                }`}
              />
            </div>
          </div>

          {/* Verdict */}
          <div className="bg-white/5 rounded-lg p-3 border-l-2 border-cyan-400/50">
            <p className="text-xs text-white/70 leading-relaxed italic">
              "{analysis.verdict}"
            </p>
          </div>

          {/* Prediction History */}
          {predictionHistory.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors w-full"
              >
                <History className="w-3 h-3" />
                <span className="uppercase font-bold">Histórico de Previsões ({predictionHistory.length})</span>
                {showHistory ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                      {predictionHistory.slice(-8).reverse().map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
                          <span className="text-white/40">{p.asset} — {p.prediction}</span>
                          {p.correct !== undefined && (
                            <span className={p.correct ? 'text-emerald-400' : 'text-red-400'}>
                              {p.correct ? '✓ Acertou' : '✗ Errou'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-white/30">Clique em atualizar para analisar {asset.symbol}</p>
        </div>
      )}
    </div>
  );
}
