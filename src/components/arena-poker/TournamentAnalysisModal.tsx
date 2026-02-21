import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Skull, TrendingUp, TrendingDown, Shield, Brain, Sparkles, Loader2, Tag, Zap, Database, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedHand } from '@/lib/handHistoryParser';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface TournamentAnalysisData {
  veredito: string;
  titulo: string;
  resumo: string;
  scoreGeral: number;
  momentosChave: { maoNumero: number; descricao: string; impacto: string }[];
  stackManagement: { nota: number; comentario: string };
  icmAwareness: { nota: number; comentario: string };
  causaEliminacao: string | null;
  fatoresSorte: string;
  conselhoFinal: string;
  tags: string[];
}

interface TournamentAnalysisModalProps {
  hands: ParsedHand[];
  onClose: () => void;
  useKB?: boolean;
}

const vereditoConfig: Record<string, { icon: typeof Trophy; color: string; label: string }> = {
  eliminado_erro_tecnico: { icon: Skull, color: 'text-red-400', label: 'Eliminado — Erro Técnico' },
  eliminado_cooler: { icon: Skull, color: 'text-orange-400', label: 'Eliminado — Cooler / Bad Beat' },
  eliminado_acumulo_erros: { icon: TrendingDown, color: 'text-red-500', label: 'Eliminado — Acúmulo de Erros' },
  eliminado_tilt: { icon: Skull, color: 'text-red-600', label: 'Eliminado — Tilt Detectado' },
  premiado_competencia: { icon: Trophy, color: 'text-[hsl(var(--arena-gold))]', label: 'Premiado — Competência' },
  premiado_sorte: { icon: Sparkles, color: 'text-green-400', label: 'Premiado — Sorte' },
  premiado_misto: { icon: TrendingUp, color: 'text-[hsl(var(--arena-cyan))]', label: 'Premiado — Misto' },
};

const TournamentAnalysisModal = ({ hands, onClose, useKB = false }: TournamentAnalysisModalProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TournamentAnalysisData | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [kbAnalysis, setKbAnalysis] = useState<any>(null);
  const [kbLoading, setKbLoading] = useState(false);

  const analyze = async () => {
    if (useKB) {
      setKbLoading(true);
      try {
        const rawHands = hands.map(h => h.raw);
        const { data: result, error } = await supabase.functions.invoke('arena-poker-kb-tournament', {
          body: { hands: rawHands },
        });
        if (error) throw error;
        if (result?.error) {
          if (result.error === 'RATE_LIMITED') {
            toast.error('Servidor ocupado. Tente novamente em alguns segundos.');
          } else {
            throw new Error(result.error);
          }
          return;
        }
        setKbAnalysis(result);
      } catch (e) {
        console.error('KB Tournament analysis error:', e);
        toast.error('Erro ao analisar torneio com KB. Tente novamente.');
      } finally {
        setKbLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const rawHands = hands.map(h => h.raw);
      const { data: result, error } = await supabase.functions.invoke('arena-poker-tournament-review', {
        body: { hands: rawHands },
      });
      if (error) throw error;
      if (result?.error) {
        if (result.error === 'RATE_LIMITED') {
          toast.error('Servidor ocupado. Tente novamente em alguns segundos.');
        } else {
          throw new Error(result.error);
        }
        return;
      }
      setFromCache(!!result?._cached);
      setData(result);
    } catch (e) {
      console.error('Tournament analysis error:', e);
      toast.error('Erro ao analisar torneio. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const cfg = data ? (vereditoConfig[data.veredito] || vereditoConfig.eliminado_erro_tecnico) : null;
  const VereditoIcon = cfg?.icon || Trophy;
  const isPremiated = data?.veredito?.startsWith('premiado');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-[hsl(var(--arena-gold)_/_0.4)] bg-card rounded-xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-md rounded-t-xl">
            <div className="flex items-center gap-2">
              {useKB ? <BookOpen className="w-5 h-5 text-[hsl(var(--arena-cyan))]" /> : <Trophy className="w-5 h-5 text-[hsl(var(--arena-gold))]" />}
              <h2 className={`font-mono text-sm font-bold uppercase tracking-[0.15em] ${useKB ? 'text-[hsl(var(--arena-cyan))]' : 'text-[hsl(var(--arena-gold))]'}`}>
                {useKB ? 'Torneio — Mycroft KB' : 'Análise de Torneio'}
              </h2>
              {data && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold ${fromCache ? 'bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]' : 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))]'}`}>
                  {fromCache ? <><Database className="w-2.5 h-2.5" /> CACHE</> : <><Zap className="w-2.5 h-2.5" /> NOVA ANÁLISE</>}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {!data && !loading && !kbAnalysis && !kbLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-8">
                {useKB ? <BookOpen className="w-16 h-16 text-[hsl(var(--arena-cyan)_/_0.5)] mx-auto" /> : <Trophy className="w-16 h-16 text-[hsl(var(--arena-gold)_/_0.5)] mx-auto" />}
                <h3 className="font-mono text-lg font-bold text-foreground">
                  {useKB ? 'Torneio — Análise Fundamentada (KB)' : 'Avaliar Desempenho no Torneio'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {useKB
                    ? <>A IA analisará as <strong className="text-[hsl(var(--arena-cyan))]">{hands.length} mãos</strong> fundamentando cada avaliação nos livros da sua Knowledge Base.</>
                    : <>A IA analisará todas as <strong className="text-[hsl(var(--arena-gold))]">{hands.length} mãos</strong> do torneio e avaliará se você foi eliminado por erro técnico, cooler ou tilt — ou se seu resultado premiado foi competência, sorte ou acaso.</>
                  }
                </p>
                <Button
                  onClick={analyze}
                  className={`font-bold uppercase tracking-wider hover:brightness-110 font-mono text-sm px-8 ${
                    useKB 
                      ? 'bg-gradient-to-r from-[hsl(var(--arena-cyan))] to-[hsl(200_100%_40%)] text-white'
                      : 'bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black'
                  }`}
                >
                  {useKB ? <BookOpen className="w-4 h-4 mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                  {useKB ? 'Analisar com KB' : 'Analisar Torneio'}
                </Button>
              </motion.div>
            )}

            {(loading || kbLoading) && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className={`w-10 h-10 animate-spin ${useKB ? 'text-[hsl(var(--arena-cyan))]' : 'text-[hsl(var(--arena-gold))]'}`} />
                <p className="font-mono text-sm text-muted-foreground animate-pulse">
                  {useKB ? `Consultando Knowledge Base + ${hands.length} mãos...` : `Analisando ${hands.length} mãos do torneio...`}
                </p>
              </div>
            )}

            {/* KB Analysis Results */}
            {kbAnalysis && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="border border-[hsl(var(--arena-cyan)_/_0.4)] rounded-lg p-5 bg-[hsl(var(--arena-cyan)_/_0.03)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono text-lg font-bold text-[hsl(var(--arena-cyan))]">{kbAnalysis.titulo || 'Análise KB'}</h3>
                    {kbAnalysis.scoreGeral !== undefined && (
                      <span className="font-mono text-3xl font-bold text-[hsl(var(--arena-gold))]">
                        {kbAnalysis.scoreGeral}<span className="text-lg text-muted-foreground">/100</span>
                      </span>
                    )}
                  </div>
                  
                  {kbAnalysis.conselho_horus && (
                    <p className="font-mono text-sm font-bold text-[hsl(var(--arena-gold))] italic mb-4">
                      🔱 "{kbAnalysis.conselho_horus}"
                    </p>
                  )}
                </div>

                {kbAnalysis.analise_torneio && (
                  <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg p-5 bg-black/40 max-h-[500px] overflow-y-auto">
                    <div className="prose prose-sm prose-invert max-w-none
                      [&_p]:text-xs [&_p]:text-white/80 [&_h1]:text-base [&_h1]:text-[hsl(var(--arena-cyan))]
                      [&_h2]:text-sm [&_h2]:text-[hsl(var(--arena-cyan)_/_0.8)] [&_h3]:text-xs
                      [&_li]:text-xs [&_strong]:text-[hsl(var(--arena-gold))]
                      [&_code]:text-[hsl(var(--arena-cyan))] [&_code]:bg-[hsl(var(--arena-cyan)_/_0.1)] [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{kbAnalysis.analise_torneio}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {kbAnalysis.leaks_principais?.length > 0 && (
                  <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
                    <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400 mb-2">Leaks Principais</h4>
                    {kbAnalysis.leaks_principais.map((l: string, i: number) => (
                      <p key={i} className="text-xs text-red-300/80 mb-1">⚠️ {l}</p>
                    ))}
                  </div>
                )}

                {kbAnalysis.livros_recomendados?.length > 0 && (
                  <div className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.03)] rounded-lg p-4">
                    <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))] mb-2">📖 Leitura Recomendada</h4>
                    {kbAnalysis.livros_recomendados.map((l: string, i: number) => (
                      <p key={i} className="text-xs text-[hsl(var(--arena-gold)_/_0.7)] mb-1">• {l}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {data && cfg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Veredito */}
                <div className={`border rounded-lg p-5 text-center space-y-2 ${isPremiated ? 'border-[hsl(var(--arena-gold)_/_0.5)] bg-[hsl(var(--arena-gold)_/_0.05)]' : 'border-red-500/30 bg-red-500/5'}`}>
                  <VereditoIcon className={`w-10 h-10 mx-auto ${cfg.color}`} />
                  <div className={`font-mono text-xs uppercase tracking-[0.2em] ${cfg.color}`}>
                    {cfg.label}
                  </div>
                  <h3 className="font-mono text-xl font-bold text-foreground">{data.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.resumo}</p>
                  <div className="font-mono text-3xl font-bold text-[hsl(var(--arena-gold))]">
                    {data.scoreGeral}<span className="text-lg text-muted-foreground">/100</span>
                  </div>
                </div>

                {/* Causa da eliminação */}
                {data.causaEliminacao && (
                  <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Skull className="w-4 h-4 text-red-400" />
                      <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">Causa da Eliminação</h4>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{data.causaEliminacao}</p>
                  </div>
                )}

                {/* Stack & ICM */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] bg-black/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5 text-[hsl(var(--arena-cyan))]" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-cyan))]">Stack Management</span>
                    </div>
                    <div className="font-mono text-2xl font-bold text-[hsl(var(--arena-cyan))]">{data.stackManagement.nota}<span className="text-sm text-muted-foreground">/100</span></div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{data.stackManagement.comentario}</p>
                  </div>
                  <div className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-black/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Brain className="w-3.5 h-3.5 text-[hsl(var(--arena-gold))]" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))]">ICM Awareness</span>
                    </div>
                    <div className="font-mono text-2xl font-bold text-[hsl(var(--arena-gold))]">{data.icmAwareness.nota}<span className="text-sm text-muted-foreground">/100</span></div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{data.icmAwareness.comentario}</p>
                  </div>
                </div>

                {/* Momentos-chave */}
                {data.momentosChave?.length > 0 && (
                  <div className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-black/40 rounded-lg p-4">
                    <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))] mb-3">
                      Momentos-Chave
                    </h4>
                    <div className="space-y-2">
                      {data.momentosChave.map((m, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className={`p-2.5 rounded-md border text-xs ${
                            m.impacto === 'positivo'
                              ? 'border-green-500/20 bg-green-500/5 text-green-400'
                              : m.impacto === 'negativo'
                              ? 'border-red-500/20 bg-red-500/5 text-red-400'
                              : 'border-[hsl(var(--arena-cyan)_/_0.2)] bg-[hsl(var(--arena-cyan)_/_0.03)] text-[hsl(var(--arena-cyan))]'
                          }`}
                        >
                          <span className="font-mono font-bold">Mão #{m.maoNumero}</span>
                          <span className="mx-1.5 opacity-40">—</span>
                          <span className="opacity-80">{m.descricao}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fatores de sorte */}
                {data.fatoresSorte && (
                  <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] bg-black/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[hsl(var(--arena-cyan))]" />
                      <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))]">Fator Sorte / Azar</h4>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{data.fatoresSorte}</p>
                  </div>
                )}

                {/* Conselho final */}
                <div className="border-2 border-[hsl(var(--arena-gold)_/_0.5)] bg-[hsl(var(--arena-gold)_/_0.05)] rounded-lg p-4 text-center">
                  <p className="font-mono text-sm font-bold text-[hsl(var(--arena-gold))] italic">
                    "{data.conselhoFinal}"
                  </p>
                </div>

                {/* Tags */}
                {data.tags?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-3 h-3 text-[hsl(var(--arena-gold)_/_0.5)]" />
                    {data.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full border border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] text-[10px] font-mono bg-[hsl(var(--arena-gold)_/_0.08)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TournamentAnalysisModal;
