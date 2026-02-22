import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Ban, Clock, Target, Shield, BarChart3, BookOpen, AlertTriangle, Crosshair, Flag, Scale, ArrowUpRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/components/dashboard/MatchCard';

interface AnalysisData {
  verdict: 'APROVADO' | 'VETADO' | 'AGUARDAR';
  market: string;
  odd: number;
  confidence: number;
  stats: {
    attacks_home: number;
    attacks_away: number;
    xG_home: number;
    xG_away: number;
    possession_home: number;
    possession_away: number;
    shots_home: number;
    shots_away: number;
  };
  thesis: string;
  risk: {
    stake_percent: number;
    stake_value: number;
    entry: string;
    stop: string;
    target: string;
    rr: string;
    ev: string;
  };
}

const verdictConfig = {
  APROVADO: { icon: '✅', bg: 'bg-success', text: 'text-success-foreground', glow: 'shadow-[0_0_30px_hsl(142_76%_36%/0.5)]' },
  VETADO: { icon: '❌', bg: 'bg-destructive', text: 'text-destructive-foreground', glow: 'shadow-[0_0_30px_hsl(0_72%_51%/0.5)]' },
  AGUARDAR: { icon: '⏸️', bg: 'bg-warning', text: 'text-warning-foreground', glow: 'shadow-[0_0_30px_hsl(38_92%_50%/0.5)]' },
};

interface AnalysisModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AnalysisModal({ match, isOpen, onClose }: AnalysisModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (m: Match) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mycroft-sports-analysis', {
        body: {
          match: {
            home: m.home,
            away: m.away,
            scoreHome: m.scoreHome,
            scoreAway: m.scoreAway,
            minute: m.minute,
            period: m.period,
            championship: m.championship,
            bankroll: 500,
          },
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setAnalysis(data as AnalysisData);
    } catch (err) {
      console.error('[AnalysisModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && match) {
      fetchAnalysis(match);
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen, match, fetchAnalysis]);

  if (!match) return null;

  const vc = analysis ? verdictConfig[analysis.verdict] : null;

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis.risk.entry);
    toast({ title: '📋 Copiado!', description: analysis.risk.entry });
  };

  const handleEntered = () => {
    toast({ title: '✅ Entrada registrada!', description: 'Boa sorte!' });
    onClose();
  };

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  const statRows = analysis ? [
    { label: 'Ataques perigosos', home: analysis.stats.attacks_home, away: analysis.stats.attacks_away },
    { label: 'xG', home: analysis.stats.xG_home, away: analysis.stats.xG_away },
    { label: 'Posse', home: `${analysis.stats.possession_home}%`, away: `${analysis.stats.possession_away}%` },
    { label: 'Chutes ao gol', home: analysis.stats.shots_home, away: analysis.stats.shots_away },
  ] : [];

  const riskItems = analysis ? [
    { icon: Target, label: 'Stake', value: `${analysis.risk.stake_percent}% (R$ ${analysis.risk.stake_value.toFixed(2)})` },
    { icon: Crosshair, label: 'Entry', value: analysis.risk.entry },
    { icon: AlertTriangle, label: 'Stop', value: analysis.risk.stop },
    { icon: Flag, label: 'Target', value: analysis.risk.target },
    { icon: Scale, label: 'R:R', value: analysis.risk.rr },
    { icon: ArrowUpRight, label: 'EV', value: analysis.risk.ev },
  ] : [];

  const content = (
    <div className="space-y-6 p-5 pb-28 md:pb-5 overflow-y-auto flex-1">
      {/* Section 1: Header */}
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-foreground">
          ⚽ {match.home} vs {match.away}
        </p>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          ⏱️ {match.minute}' | {match.scoreHome}-{match.scoreAway}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-10 h-10 text-primary" />
          </motion.div>
          <p className="text-sm text-muted-foreground font-orbitron">🤖 Mycroft analisando...</p>
          <p className="text-xs text-muted-foreground">Processando dados com IA Anthropic</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button
            onClick={() => match && fetchAnalysis(match)}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Analysis Content */}
      {analysis && vc && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
          {/* Section 2: Verdict */}
          <motion.div variants={fadeUp} className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className={cn('px-8 py-3 rounded-xl font-orbitron text-xl font-bold uppercase tracking-widest', vc.bg, vc.text, vc.glow)}
            >
              {vc.icon} {analysis.verdict}
            </motion.div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-sm text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Mercado</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{analysis.market}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Odd</p>
                <p className="text-sm font-bold text-primary mt-0.5">{analysis.odd}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Confiança</p>
                <p className="text-sm font-bold text-success mt-0.5">{analysis.confidence}%</p>
              </div>
            </div>
            <Progress value={analysis.confidence} className="h-2 max-w-sm w-full [&>div]:bg-success" />
          </motion.div>

          {/* Section 3: Stats */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> Situação do Jogo
            </h3>
            <div className="luxury-card p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <p className="font-bold text-foreground">{match.home}</p>
                <p className="text-muted-foreground text-xs" />
                <p className="font-bold text-foreground">{match.away}</p>
              </div>
              {statRows.map(row => (
                <div key={row.label} className="grid grid-cols-3 gap-2 text-center text-sm py-1.5 border-t border-border">
                  <p className="font-bold text-foreground">{row.home}</p>
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="font-bold text-foreground">{row.away}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section 4: Thesis */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Fundamentação Mycroft
            </h3>
            <div className="luxury-card p-5 border-l-4 border-l-success">
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed italic">
                {analysis.thesis}
              </p>
            </div>
          </motion.div>

          {/* Section 5: Risk Management */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Gestão de Risco
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {riskItems.map(item => (
                <div key={item.label} className="luxury-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-orbitron uppercase">{item.label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section 6: Actions (desktop inline) */}
          <motion.div variants={fadeUp} className="hidden md:flex gap-3">
            <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent/20 border border-accent/30 text-accent font-orbitron text-sm font-bold uppercase hover:bg-accent/30 transition-colors">
              <Copy className="w-4 h-4" /> Copiar Entrada
            </button>
            <button onClick={handleEntered} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success text-success-foreground font-orbitron text-sm font-bold uppercase hover:brightness-110 transition-all">
              <Check className="w-4 h-4" /> Entrei
            </button>
            <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-muted-foreground font-orbitron text-sm font-bold uppercase hover:bg-secondary/50 transition-colors">
              <Ban className="w-4 h-4" /> Dispensar
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );

  const panelVariants = isMobile
    ? { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } }
    : { hidden: { x: '100%' }, visible: { x: 0 }, exit: { x: '100%' } };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          />

          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed z-50 bg-card border-border flex flex-col',
              isMobile ? 'inset-0' : 'top-0 right-0 bottom-0 w-[60%] max-w-2xl border-l'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-orbitron text-sm font-bold text-primary uppercase tracking-wider">
                🤖 Análise Mycroft
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {content}

            {/* Mobile fixed bottom actions */}
            {isMobile && analysis && (
              <div className="fixed bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-lg border-t border-border flex gap-2 z-50">
                <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-accent/20 border border-accent/30 text-accent font-orbitron text-xs font-bold uppercase">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
                <button onClick={handleEntered} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-success text-success-foreground font-orbitron text-xs font-bold uppercase">
                  <Check className="w-3.5 h-3.5" /> Entrei
                </button>
                <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border text-muted-foreground font-orbitron text-xs font-bold uppercase">
                  <Ban className="w-3.5 h-3.5" /> Dispensar
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
