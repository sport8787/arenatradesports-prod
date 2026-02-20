import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Trophy, Target, Eye, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ParsedHand } from '@/lib/handHistoryParser';

interface AnalysisResult {
  veredito: { nota: number; resumo: string };
  scriptVencedor: { titulo: string; passos: { street: string; acao: string; explicacao: string }[] };
  visaoHorus: { insight: string; leituraVilao: string; conselho: string };
}

const HORUS_LOADING_PHRASES = [
  "Paciência… Dissecar uma decisão leva tempo. Ser lido pelo seu oponente é instantâneo.",
  "Muitos blefam para vencer. Os melhores blefam para sobreviver. Onde você se encaixa?",
  "Suas cartas dizem uma coisa. Sua agressividade diz outra. Vamos ver o que o Mycroft acha dessa dissonância.",
  "O feltro não perdoa o ego. Estou vendo se foi ele quem tomou essa decisão por você.",
  "Cada chip apostado conta uma história. Vamos descobrir se a sua foi ficção ou realidade.",
  "O vilão não precisa acertar sempre. Ele só precisa acertar quando importa. Será que você fez o mesmo?",
  "Enquanto você esperava a carta perfeita, o vilão estava lendo suas hesitações.",
  "Poker não é sobre as cartas que você tem. É sobre a história que você conta. Vamos auditar a sua.",
  "Relaxe. Até os melhores cometem erros. A diferença é que eles aprendem com cada um deles.",
  "Estou cruzando os dados com o Mycroft. Ele não perdoa. Eu, talvez, se você merecer.",
];

function useRotatingPhrase(active: boolean, intervalMs = 4500) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * HORUS_LOADING_PHRASES.length));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex(i => (i + 1) % HORUS_LOADING_PHRASES.length), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return HORUS_LOADING_PHRASES[index];
}

interface HandAnalysisModalProps {
  hand: ParsedHand;
  onClose: () => void;
}

const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColor: Record<string, string> = {
  s: 'text-foreground',
  h: 'text-red-500',
  d: 'text-blue-400',
  c: 'text-green-400',
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-[hsl(var(--success))]';
  if (score >= 50) return 'text-[hsl(var(--arena-gold))]';
  return 'text-[hsl(var(--destructive))]';
}

function getScoreBarColor(score: number) {
  if (score >= 80) return 'bg-[hsl(var(--success))]';
  if (score >= 50) return 'bg-[hsl(var(--arena-gold))]';
  return 'bg-[hsl(var(--destructive))]';
}

const HandAnalysisModal = ({ hand, onClose }: HandAnalysisModalProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const horusPhrase = useRotatingPhrase(isLoading);

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-analyze', {
        body: { handHistory: hand.raw },
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Erro na análise. Tente novamente.');
        setIsLoading(false);
        return;
      }

      setAnalysis(data);
      toast.success('Análise completa!');
    } catch (err) {
      console.error('Analysis failed:', err);
      toast.error('Falha ao analisar. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[hsl(var(--arena-gold)_/_0.3)] bg-black/95 backdrop-blur-md"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b border-border bg-black/95">
            <div className="flex items-center gap-4">
              {/* Large Cards */}
              <div className="flex items-center gap-1.5">
                {hand.heroCards.map((card, i) => (
                  <div
                    key={i}
                    className={`w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-xl ${
                      hand.heroWon
                        ? 'border-[hsl(var(--arena-gold))] bg-[hsl(var(--arena-gold)_/_0.1)] shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.3)]'
                        : 'border-border bg-secondary'
                    }`}
                  >
                    <span className={suitColor[card.suit]}>{card.rank}</span>
                    <span className={`text-base ${suitColor[card.suit]}`}>{suitSymbol[card.suit]}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground uppercase">{hand.heroPosition}</span>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="font-mono text-sm font-bold">{hand.potSizeBB}BB</span>
                  <span className="text-muted-foreground/30">•</span>
                  <span className={`font-mono text-xs font-bold ${hand.heroWon ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                    {hand.heroWon ? 'VITÓRIA' : 'DERROTA'}
                  </span>
                </div>
                {hand.boardCards.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="font-mono text-[10px] text-muted-foreground mr-1">BOARD:</span>
                    {hand.boardCards.map((card, i) => (
                      <span key={i} className={`font-mono text-sm ${suitColor[card.suit]}`}>
                        {card.rank}{suitSymbol[card.suit]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {!analysis && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10 space-y-6"
              >
                <div className="space-y-2">
                  <p className="font-mono text-sm text-muted-foreground">
                    Pronto para a análise profunda desta mão?
                  </p>
                  <p className="font-mono text-xs text-muted-foreground/60">
                    Mycroft identificará leaks técnicos e Hórus revelará insights estratégicos.
                  </p>
                </div>
                <Button
                  onClick={runAnalysis}
                  className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider hover:brightness-110 font-mono text-sm px-8 py-3"
                >
                  <Brain className="w-5 h-5 mr-2" />
                  Análise por Hórus & Mycroft
                </Button>
              </motion.div>
            )}

            {isLoading && <AnalysisSkeleton horusPhrase={horusPhrase} />}

            {analysis && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {/* ── RELATÓRIO FORENSE: MYCROFT 2.0 ── */}
                <div className="border border-[#00D2FF]/30 rounded-xl p-6 bg-[#00D2FF]/[0.03] space-y-8">
                  <h2 className="font-mono text-[20px] font-black uppercase tracking-[0.15em] text-[#00D2FF] flex items-center gap-3">
                    <Zap className="w-6 h-6 text-[#00D2FF]" />
                    Relatório Forense: Mycroft 2.0
                  </h2>

                  {/* Veredito */}
                  <section className="space-y-3">
                    <h3 className="font-mono text-base font-bold uppercase tracking-wider text-[#00D2FF]/80 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      O Veredito
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-5xl font-black ${getScoreColor(analysis.veredito.nota)}`}>
                        {analysis.veredito.nota}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.veredito.nota}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full rounded-full ${getScoreBarColor(analysis.veredito.nota)}`}
                          />
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{analysis.veredito.resumo}</p>
                      </div>
                    </div>
                  </section>

                  {/* Script do Vencedor */}
                  <section className="space-y-3">
                    <h3 className="font-mono text-base font-bold uppercase tracking-wider text-[#00D2FF]/80 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      O Script do Vencedor
                    </h3>
                    <p className="font-mono text-sm text-muted-foreground mb-3">{analysis.scriptVencedor.titulo}</p>
                    <div className="space-y-3">
                      {analysis.scriptVencedor.passos.map((passo, i) => (
                        <div key={i} className="border border-[#00D2FF]/15 rounded-lg p-4 bg-[#00D2FF]/[0.02]">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#00D2FF]/15 text-[#00D2FF] uppercase font-bold">
                              {passo.street}
                            </span>
                            <span className="font-mono text-sm font-bold text-foreground">{passo.acao}</span>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{passo.explicacao}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <p className="font-mono text-[10px] text-[#00D2FF]/40 uppercase tracking-widest text-right">
                    Assinado digitalmente — Mycroft 2.0 | Perito Forense
                  </p>
                </div>

                {/* ── VEREDITO DE HÓRUS ── */}
                <section className="space-y-3">
                  <h2 className="font-mono text-[20px] font-black uppercase tracking-[0.15em] text-[#D4AF37] flex items-center gap-3">
                    <Eye className="w-6 h-6 text-[#D4AF37]" />
                    Veredito de Hórus
                  </h2>
                  <div className="border border-[#D4AF37]/25 rounded-xl p-5 bg-[#D4AF37]/[0.03] space-y-4">
                    <p className="font-mono text-sm text-foreground italic">"{analysis.visaoHorus.insight}"</p>
                    <div>
                      <p className="font-mono text-[10px] text-[#D4AF37]/50 uppercase tracking-wider mb-1">Leitura do Vilão</p>
                      <p className="font-mono text-sm text-foreground">{analysis.visaoHorus.leituraVilao}</p>
                    </div>
                    <div className="border-t border-[#D4AF37]/15 pt-3">
                      <p className="font-mono text-sm font-bold text-[#D4AF37]">"{analysis.visaoHorus.conselho}"</p>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function AnalysisSkeleton({ horusPhrase }: { horusPhrase: string }) {
  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Hórus speaking */}
      <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-5 bg-[hsl(var(--arena-gold)_/_0.04)]">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
          <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold">Hórus diz:</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={horusPhrase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="font-mono text-sm text-[hsl(var(--arena-gold))] italic leading-relaxed"
          >
            "{horusPhrase}"
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded bg-[hsl(var(--arena-gold)_/_0.1)]" />
          <Skeleton className="h-6 w-40 bg-[hsl(var(--arena-gold)_/_0.1)]" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-14 rounded bg-[hsl(var(--arena-gold)_/_0.08)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full rounded-full bg-secondary" />
            <Skeleton className="h-4 w-3/4 bg-secondary" />
          </div>
        </div>
      </div>

      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-20 w-full rounded-lg bg-secondary/30" />
      ))}

      <p className="text-center font-mono text-xs text-muted-foreground animate-pulse">
        Mycroft & Hórus analisando esta mão...
      </p>
    </div>
  );
}

export default HandAnalysisModal;
