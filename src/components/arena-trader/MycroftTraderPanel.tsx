import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Bot, RefreshCw, Shield, Target, AlertTriangle, TrendingUp, TrendingDown, Eye, History, ChevronDown, ChevronUp, CheckCircle, XCircle, Building2, Crosshair, ShieldCheck } from 'lucide-react';
import type { Asset } from '@/pages/ArenaTrader';

interface PredictionRecord {
  timestamp: number;
  asset: string;
  prediction: string;
  priceAtPrediction: number;
  currentPrice?: number;
  correct?: boolean;
}

interface PositionSizing {
  risco_maximo_tc: number;
  size_sugerido_tc: number;
  sl_preco: number;
  tp_preco: number;
  rr_ratio: number;
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
    confluenciaScore?: number;
    indicadoresConfirmados?: string[];
    statusInstitucional?: string;
    classeFluxo?: string;
    positionSizing?: PositionSizing;
    proveniencia?: string;
    confiancaAnalise?: number;
  } | null;
  isAnalyzing: boolean;
  onRequestAnalysis: () => void;
  asset: Asset;
  predictionHistory?: PredictionRecord[];
}

function ProvenanceBadge({ proveniencia, confianca }: { proveniencia?: string; confianca?: number }) {
  const isLive = proveniencia === 'LIVE';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
      isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
      {proveniencia || 'N/A'}
      {confianca !== undefined && <span className="ml-1 opacity-70">({confianca}%)</span>}
    </div>
  );
}

function ConfluenceIndicator({ score, indicators }: { score?: number; indicators?: string[] }) {
  if (score === undefined) return null;
  const color = score >= 7 ? 'emerald' : score >= 4 ? 'amber' : 'red';
  return (
    <div className={`rounded-lg p-2.5 border bg-${color}-500/5 border-${color}-500/20`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Crosshair className={`w-3.5 h-3.5 text-${color}-400`} />
        <span className="text-[10px] font-bold text-cyan-400 uppercase">Confluência Técnica</span>
        <span className={`ml-auto text-xs font-orbitron font-bold text-${color}-400`}>{score}/10</span>
      </div>
      {score < 5 && (
        <p className="text-[9px] text-red-400/80 mb-1.5">⚠️ Confluência insuficiente para setup válido</p>
      )}
      {indicators && indicators.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {indicators.map((ind, i) => (
            <span key={i} className="text-[9px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/60 flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
              {ind}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InstitutionalFlowBadge({ status, classeFluxo }: { status?: string; classeFluxo?: string }) {
  if (!status) return null;
  const colorMap: Record<string, string> = {
    'ACUMULAÇÃO': 'emerald',
    'DISTRIBUIÇÃO': 'red',
    'NEUTRO': 'amber',
  };
  const color = colorMap[status] || 'amber';
  const iconMap: Record<string, string> = {
    'ACUMULAÇÃO': '🐋',
    'DISTRIBUIÇÃO': '📉',
    'NEUTRO': '⏸️',
  };
  return (
    <div className={`rounded-lg p-2.5 border bg-${color}-500/5 border-${color}-500/20`}>
      <div className="flex items-center gap-2 mb-1">
        <Building2 className={`w-3.5 h-3.5 text-${color}-400`} />
        <span className="text-[10px] font-bold text-cyan-400 uppercase">Fluxo Institucional</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold text-${color}-400`}>
          {iconMap[status] || ''} {status}
        </span>
        {classeFluxo && (
          <span className="text-[9px] text-white/40">{classeFluxo}</span>
        )}
      </div>
    </div>
  );
}

function PositionSizingCard({ sizing }: { sizing?: PositionSizing | null }) {
  if (!sizing) return null;
  return (
    <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] font-bold text-cyan-400 uppercase">Position Sizing (1% Risco)</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="flex justify-between">
          <span className="text-white/40">Size:</span>
          <span className="text-white/80 font-bold">{sizing.size_sugerido_tc?.toLocaleString()} TC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Risco Max:</span>
          <span className="text-red-400 font-bold">{sizing.risco_maximo_tc?.toLocaleString()} TC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">SL:</span>
          <span className="text-red-400">{sizing.sl_preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">TP:</span>
          <span className="text-emerald-400">{sizing.tp_preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      {sizing.rr_ratio && (
        <div className="mt-1.5 text-center">
          <span className="text-[9px] text-white/40">R:R = </span>
          <span className={`text-[10px] font-bold ${sizing.rr_ratio >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
            1:{sizing.rr_ratio?.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
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
            <p className="text-[10px] text-cyan-400/50">Auditoria Forense</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && <ProvenanceBadge proveniencia={analysis.proveniencia} confianca={analysis.confiancaAnalise} />}
          <button
            onClick={onRequestAnalysis}
            disabled={isAnalyzing}
            className="p-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isAnalyzing ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-cyan-500/10 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
          ))}
          <p className="text-xs text-cyan-400/50 text-center mt-3">Auditoria forense em {asset.symbol}...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          {/* Confluence Score */}
          <ConfluenceIndicator score={analysis.confluenciaScore} indicators={analysis.indicadoresConfirmados} />

          {/* Institutional Flow */}
          <InstitutionalFlowBadge status={analysis.statusInstitucional} classeFluxo={analysis.classeFluxo} />

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

          {/* Position Sizing Card */}
          <PositionSizingCard sizing={analysis.positionSizing} />

          {/* Recommended position size (legacy fallback) */}
          {!analysis.positionSizing && analysis.recomendacaoAporte && (
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
          <div className="bg-white/5 rounded-lg p-3 border-l-2 border-cyan-400/50 max-h-80 overflow-y-auto">
            <div className="prose prose-sm prose-invert prose-p:text-white/70 prose-p:text-xs prose-p:leading-relaxed prose-headings:text-cyan-400 prose-headings:text-xs prose-headings:font-bold prose-strong:text-white/90 prose-li:text-white/60 prose-li:text-[11px] prose-ul:my-1 prose-ol:my-1 prose-p:my-1">
              <ReactMarkdown>{analysis.verdict}</ReactMarkdown>
            </div>
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
