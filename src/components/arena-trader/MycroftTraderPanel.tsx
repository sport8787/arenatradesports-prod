import { motion } from 'framer-motion';
import { Bot, RefreshCw, Shield, Target, AlertTriangle } from 'lucide-react';
import type { Asset } from '@/pages/ArenaTrader';

interface MycroftTraderPanelProps {
  analysis: {
    support: number;
    resistance: number;
    trend: string;
    verdict: string;
    riskLevel: number;
  } | null;
  isAnalyzing: boolean;
  onRequestAnalysis: () => void;
  asset: Asset;
}

export default function MycroftTraderPanel({ analysis, isAnalyzing, onRequestAnalysis, asset }: MycroftTraderPanelProps) {
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

          {/* Trend */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 uppercase">Tendência:</span>
            <span className={`text-xs font-bold ${analysis.trend === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
              {analysis.trend === 'bullish' ? '📈 Altista' : '📉 Baixista'}
            </span>
          </div>

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
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-white/30">Clique em atualizar para analisar {asset.symbol}</p>
        </div>
      )}
    </div>
  );
}
