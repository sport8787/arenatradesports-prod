import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Activity, AlertTriangle,
  ChevronRight, Loader2, BarChart3, User, Zap, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MonocleIcon } from './PersonaIcons';
import type { ParsedHand } from '@/lib/handHistoryParser';

// ─── Types ───────────────────────────────────────────────────
interface Trend {
  id: string;
  title: string;
  direction: 'edge' | 'leak_pattern';
  category: 'preflop' | 'postflop' | 'mental' | 'sizing' | 'positional';
  frequency: number;
  impact: string;
  description: string;
  evidence: string;
  adjustment: string;
  hands: number[];
}

interface PriorityAdjustment {
  rank: number;
  title: string;
  description: string;
  expectedImpact: string;
}

interface PlayerProfile {
  style: string;
  styleDescription: string;
  consistencyIndex: number;
  vpip_estimate: string;
  pfr_estimate: string;
  aggression_estimate: string;
}

interface TrendsData {
  playerProfile: PlayerProfile;
  trends: Trend[];
  priorityAdjustments: PriorityAdjustment[];
  summary: string;
}

// ─── Category Config ─────────────────────────────────────────
const categoryConfig: Record<string, { label: string; icon: string }> = {
  preflop: { label: 'Preflop', icon: '🃏' },
  postflop: { label: 'Postflop', icon: '🎯' },
  mental: { label: 'Mental Game', icon: '🧠' },
  sizing: { label: 'Sizing', icon: '📐' },
  positional: { label: 'Posicional', icon: '📍' },
};

// ─── Trend Card ──────────────────────────────────────────────
function TrendCard({ trend, index }: { trend: Trend; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isEdge = trend.direction === 'edge';
  const cat = categoryConfig[trend.category] || { label: trend.category, icon: '📊' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`border rounded-xl p-4 cursor-pointer transition-colors ${
        isEdge
          ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
          : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isEdge ? (
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <div>
            <h4 className="font-mono text-sm font-bold text-foreground">{trend.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-muted-foreground">{cat.icon} {cat.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground">•</span>
              <span className={`text-[10px] font-mono font-bold ${isEdge ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend.frequency}% freq
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[9px] ${isEdge ? 'border-emerald-500/40 text-emerald-400' : 'border-red-500/40 text-red-400'}`}>
            {trend.impact}
          </Badge>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{trend.description}</p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
              <div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Evidências</span>
                <p className="text-xs text-foreground/80 mt-0.5">{trend.evidence}</p>
                <p className="font-mono text-[9px] text-muted-foreground mt-1">
                  Mãos: {trend.hands.map(h => `#${h}`).join(', ')}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${isEdge ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold"
                  style={{ color: isEdge ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}>
                  {isEdge ? '✓ Manter & Potencializar' : '⚡ Ajuste Recomendado'}
                </span>
                <p className="text-xs text-foreground/80 mt-1">{trend.adjustment}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────
interface TrendsAlertPanelProps {
  hands: ParsedHand[];
  onClose: () => void;
}

const TrendsAlertPanel = ({ hands, onClose }: TrendsAlertPanelProps) => {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyze = useCallback(async () => {
    if (hands.length < 3) {
      toast.error('Mínimo de 3 mãos para análise de tendências.');
      return;
    }
    setLoading(true);
    try {
      const rawHands = hands.map(h => h.raw);
      const { data: result, error } = await supabase.functions.invoke('arena-poker-trends', {
        body: { hands: rawHands },
      });
      if (error) throw error;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setData(result);
      setHasAnalyzed(true);
    } catch (err) {
      console.error('Trends analysis error:', err);
      toast.error('Erro na análise de tendências. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [hands]);

  const edges = data?.trends.filter(t => t.direction === 'edge') || [];
  const leaks = data?.trends.filter(t => t.direction === 'leak_pattern') || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl bg-background border border-border rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-border p-5 flex items-center justify-between bg-gradient-to-r from-[hsl(var(--arena-cyan)_/_0.05)] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--arena-cyan)_/_0.15)] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="text-[hsl(var(--arena-cyan))]">Alerta de Tendências</span>
                <span className="text-muted-foreground">— Mycroft 2.0</span>
              </h2>
              <p className="text-[10px] text-muted-foreground font-mono">
                Análise de padrões recorrentes • {hands.length} mãos no histórico
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Pre-analysis state */}
          {!hasAnalyzed && !loading && (
            <div className="text-center py-10 space-y-4">
              <MonocleIcon className="mx-auto text-[hsl(var(--arena-cyan))]" size={48} />
              <div>
                <h3 className="font-mono text-lg font-bold text-foreground">Análise de Tendências</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Mycroft vai analisar todas as {hands.length} mãos para identificar padrões recorrentes
                  no seu jogo — tanto vantagens quanto padrões desvantajosos.
                </p>
              </div>
              <Button
                onClick={analyze}
                className="bg-[hsl(var(--arena-cyan))] text-black font-mono font-bold uppercase tracking-wider"
              >
                <BarChart3 className="w-4 h-4 mr-2" /> Analisar Tendências
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-14 space-y-3">
              <Loader2 className="w-10 h-10 text-[hsl(var(--arena-cyan))] animate-spin mx-auto" />
              <p className="font-mono text-sm text-[hsl(var(--arena-cyan))]">
                Mycroft analisando {hands.length} mãos por tendências...
              </p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          )}

          {/* Results */}
          {data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Player Profile Card */}
              <div className="border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-xl p-4 bg-[hsl(var(--arena-cyan)_/_0.03)]">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[hsl(var(--arena-cyan))]" />
                  <h3 className="font-mono text-xs uppercase tracking-widest text-[hsl(var(--arena-cyan))] font-bold">
                    Perfil do Jogador
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="font-mono text-lg font-black text-[hsl(var(--arena-cyan))]">{data.playerProfile.style}</p>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Estilo</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-lg font-black text-foreground">{data.playerProfile.vpip_estimate}</p>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">VPIP est.</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-lg font-black text-foreground">{data.playerProfile.pfr_estimate}</p>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">PFR est.</p>
                  </div>
                  <div className="text-center">
                    <div className="relative inline-block">
                      <p className="font-mono text-lg font-black"
                        style={{
                          color: data.playerProfile.consistencyIndex > 70
                            ? 'hsl(var(--destructive))'
                            : data.playerProfile.consistencyIndex > 40
                            ? 'hsl(var(--arena-gold))'
                            : 'hsl(var(--success))',
                        }}
                      >
                        {data.playerProfile.consistencyIndex}
                      </p>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Previsibilidade</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{data.playerProfile.styleDescription}</p>
              </div>

              {/* Summary */}
              <div className="border border-border/50 rounded-xl p-4">
                <p className="text-sm text-foreground/80 leading-relaxed">{data.summary}</p>
              </div>

              {/* Edges (positive trends) */}
              {edges.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold">
                      Vantagens Identificadas ({edges.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {edges.map((t, i) => <TrendCard key={t.id} trend={t} index={i} />)}
                  </div>
                </div>
              )}

              {/* Leak patterns (negative trends) */}
              {leaks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="font-mono text-xs uppercase tracking-widest text-red-400 font-bold">
                      Padrões Desvantajosos ({leaks.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {leaks.map((t, i) => <TrendCard key={t.id} trend={t} index={i} />)}
                  </div>
                </div>
              )}

              {/* Priority Adjustments */}
              {data.priorityAdjustments.length > 0 && (
                <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-xl p-4 bg-[hsl(var(--arena-gold)_/_0.03)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
                    <h3 className="font-mono text-xs uppercase tracking-widest text-[hsl(var(--arena-gold))] font-bold">
                      Ajustes Prioritários
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {data.priorityAdjustments.map((adj, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-[hsl(var(--arena-gold)_/_0.2)] flex items-center justify-center shrink-0">
                          <span className="font-mono text-xs font-black text-[hsl(var(--arena-gold))]">{adj.rank}</span>
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-foreground">{adj.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{adj.description}</p>
                          <Badge variant="outline" className="mt-1 text-[9px] border-[hsl(var(--arena-gold)_/_0.4)] text-[hsl(var(--arena-gold))]">
                            Impacto: {adj.expectedImpact}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature */}
              <p className="font-mono text-[10px] text-[hsl(var(--arena-cyan)_/_0.3)] uppercase tracking-widest text-right">
                Assinado digitalmente — Mycroft Trends Analyzer 2.0
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TrendsAlertPanel;
