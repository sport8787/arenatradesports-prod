import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, AlertTriangle, Check, X, ArrowLeft,
  BarChart3, Target, Zap, Trophy,
  ChevronDown, ChevronUp, Copy, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';

// ============================================================================
// TYPES
// ============================================================================

interface EligibleBet {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  odd: number;
  asset_score: number;
  edge: number;
  probability: number;
  commence_time: string;
  bookmaker: string;
}

interface OptimizedParlay {
  id: string;
  bets: EligibleBet[];
  score: number;
  totalOdd: number;
  avgEdge: number;
  avgCorrelation: number;
  combinedProbability: number;
  expectedROI: number;
  kellyStake: number;
  breakdown: {
    edgeScore: number;
    independenceScore: number;
    probabilityScore: number;
    sharpeScore: number;
  };
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MultiBetOptimizerPage() {
  const navigate = useNavigate();
  const [numSelections, setNumSelections] = useState(4);
  const [minAssetScore, setMinAssetScore] = useState(75);
  const [maxCorrelation, setMaxCorrelation] = useState(0.3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parlays, setParlays] = useState<OptimizedParlay[]>([]);
  const [stats, setStats] = useState<{ eligible: number; total: number; combos: number } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setParlays([]);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke('multi-bet-optimizer', {
        body: {
          num_selections: numSelections,
          min_asset_score: minAssetScore,
          max_correlation: maxCorrelation,
          top_k: 5,
        },
      });

      if (error) throw error;

      if (data.parlays?.length > 0) {
        setParlays(data.parlays);
        setStats({
          eligible: data.eligible_count,
          total: data.total_available,
          combos: data.total_combinations_scored || 0,
        });
        toast.success(`${data.parlays.length} múltiplas otimizadas de ${data.total_combinations_scored || 0} combinações`);
      } else {
        toast.info(data.message || 'Nenhuma múltipla encontrada');
        setStats({ eligible: data.eligible_count, total: data.total_available, combos: 0 });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar múltiplas: ' + (err.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
              MULTI-BET OPTIMIZER
            </h1>
            <span className="text-[10px] text-muted-foreground font-mono border border-border px-1.5 py-0.5 rounded">
              BETA
            </span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-3xl">
        <PunterBreadcrumb items={[{ label: 'Gerador de Múltipla' }]} />
        {/* Warning Banner */}
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-xs font-semibold text-warning mb-1">AVISO IMPORTANTE</p>
                <p className="text-xs text-muted-foreground">
                  Entradas múltiplas REDUZEM seu edge. Se possível, aposte SIMPLES.
                  Mas se você REALMENTE quer fazer múltipla, use as sugestões abaixo para maximizar suas chances.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">Disponíveis</p>
                <p className="font-mono text-xl font-bold text-foreground">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">Elegíveis</p>
                <p className="font-mono text-xl font-bold text-success">{stats.eligible}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">Combinações</p>
                <p className="font-mono text-xl font-bold text-primary">{stats.combos.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Configuration */}
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-6">
            <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configuração
            </h2>

            {/* Num Selections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-muted-foreground">Número de seleções</label>
                <Badge variant="secondary" className="font-mono">{numSelections}</Badge>
              </div>
              <Slider
                value={[numSelections]}
                onValueChange={([v]) => setNumSelections(v)}
                min={3}
                max={8}
                step={1}
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>3</span><span>5</span><span>8</span>
              </div>
            </div>

            {/* Min Asset Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-muted-foreground">Mínimo Asset Score</label>
                <Badge variant="secondary" className="font-mono text-warning">{minAssetScore}</Badge>
              </div>
              <Slider
                value={[minAssetScore]}
                onValueChange={([v]) => setMinAssetScore(v)}
                min={50}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>50</span><span>75</span><span>100</span>
              </div>
            </div>

            {/* Max Correlation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-muted-foreground">Máxima Correlação</label>
                <Badge variant="secondary" className="font-mono text-primary">{maxCorrelation.toFixed(1)}</Badge>
              </div>
              <Slider
                value={[maxCorrelation * 10]}
                onValueChange={([v]) => setMaxCorrelation(v / 10)}
                min={0}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>0.0</span><span>0.5</span><span>1.0</span>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 font-mono text-sm font-semibold"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Otimizando combinações...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  GERAR MÚLTIPLAS OTIMIZADAS
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {parlays.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-warning" />
                <h2 className="font-mono text-sm font-semibold text-foreground">
                  Top {parlays.length} Múltiplas Recomendadas
                </h2>
              </div>

              {parlays.map((parlay, index) => (
                <ParlayCard key={parlay.id} parlay={parlay} rank={index + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {parlays.length === 0 && !isGenerating && (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground mb-1">
                Configure os parâmetros acima
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/60">
                e clique em "Gerar Múltiplas Otimizadas" para ver as sugestões
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PARLAY CARD
// ============================================================================

function ParlayCard({ parlay, rank }: { parlay: OptimizedParlay; rank: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getRankEmoji = (r: number) => {
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return `#${r}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return 'text-success';
    if (score >= 0.75) return 'text-primary';
    if (score >= 0.65) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.85) return 'EXCELENTE';
    if (score >= 0.75) return 'MUITO BOM';
    if (score >= 0.65) return 'BOM';
    return 'REGULAR';
  };

  const copyToClipboard = () => {
    const text = parlay.bets
      .map(b => `${b.home_team} vs ${b.away_team} | ${b.market} @${b.odd}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Múltipla copiada!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
    >
      <Card className="border-border bg-card hover:border-primary/30 transition-colors">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg sm:text-xl shrink-0">{getRankEmoji(rank)}</span>
              <div className="min-w-0">
                <p className={`font-mono text-[11px] sm:text-sm font-bold ${getScoreColor(parlay.score)} truncate`}>
                  SCORE {parlay.score.toFixed(2)} ({getScoreLabel(parlay.score)})
                </p>
                <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">
                  {parlay.bets.length} seleções
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors shrink-0"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Bets List */}
          <div className="space-y-1.5">
            {parlay.bets.map((bet, i) => (
              <div key={bet.id} className="flex items-center justify-between gap-2 p-2 sm:p-2.5 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground shrink-0">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] sm:text-xs font-medium text-foreground truncate">
                      {bet.home_team} vs {bet.away_team}
                    </p>
                    <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      {bet.league} • {bet.market}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono text-[11px] sm:text-xs font-bold text-foreground">@{bet.odd.toFixed(2)}</span>
                  <Badge
                    variant="secondary"
                    className={`font-mono text-[9px] sm:text-[10px] px-1.5 ${
                      bet.asset_score >= 90 ? 'bg-warning/20 text-warning' :
                      bet.asset_score >= 70 ? 'bg-primary/20 text-primary' :
                      'bg-success/20 text-success'
                    }`}
                  >
                    {bet.asset_score}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricBox label="Odd Total" value={parlay.totalOdd.toFixed(2)} icon={Target} variant="primary" />
            <MetricBox label="Edge Médio" value={`${parlay.avgEdge.toFixed(1)}%`} icon={TrendingUp} variant="success" />
            <MetricBox
              label="Correlação"
              value={parlay.avgCorrelation.toFixed(2)}
              sublabel={parlay.avgCorrelation < 0.2 ? 'BAIXA ✓' : 'MÉDIA'}
              icon={BarChart3}
              variant="accent"
            />
            <MetricBox label="Prob. Acerto" value={`${parlay.combinedProbability.toFixed(1)}%`} icon={Target} variant="warning" />
          </div>

          {/* Comparative */}
          <div className="p-2.5 sm:p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="font-mono text-[9px] sm:text-[10px] font-semibold text-primary mb-1.5 sm:mb-2">
              💰 COMPARATIVO (R$ 100 apostado)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">Se entradas SIMPLES:</p>
                <p className="font-mono text-[11px] sm:text-xs font-bold text-foreground">
                  EV +R$ {(parlay.avgEdge * parlay.bets.length).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">Se esta MÚLTIPLA:</p>
                <p className="font-mono text-[11px] sm:text-xs font-bold text-success">
                  EV +R$ {(parlay.expectedROI).toFixed(2)} ({parlay.expectedROI > 0 ? '+' : ''}{parlay.expectedROI.toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>

          {/* Kelly */}
          <div className="p-2.5 sm:p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="font-mono text-[9px] sm:text-[10px] font-semibold text-accent-foreground mb-1">
              🎲 KELLY CRITERION
            </p>
            <p className="font-mono text-[11px] sm:text-xs text-muted-foreground">
              Stake Sugerido: <span className="font-bold text-foreground">{parlay.kellyStake}%</span> da banca
            </p>
            <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
              Banca R$ 10.000 → Stake: R$ {(10000 * parlay.kellyStake / 100).toFixed(0)}
            </p>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-3 border-t border-border"
              >
                <div>
                  <p className="font-mono text-[10px] font-semibold text-foreground mb-2">📊 Análise Detalhada</p>
                  <div className="space-y-1.5">
                    <AnalysisRow label="Edge agregado positivo" value={`${parlay.avgEdge.toFixed(1)}%`} status="good" />
                    <AnalysisRow
                      label="Correlação baixa"
                      value={parlay.avgCorrelation.toFixed(2)}
                      status={parlay.avgCorrelation < 0.2 ? 'good' : 'warning'}
                    />
                    <AnalysisRow label={`Todos Asset Score > ${Math.min(...parlay.bets.map(b => b.asset_score))}`} value="✓" status="good" />
                    <AnalysisRow
                      label="Probabilidade conjunta"
                      value={`${parlay.combinedProbability.toFixed(1)}%`}
                      status={parlay.combinedProbability > 15 ? 'good' : 'warning'}
                    />
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[10px] font-semibold text-foreground mb-2">⚠️ Fatores de Risco</p>
                  <div className="space-y-1">
                    {parlay.avgCorrelation < 0.2 && (
                      <RiskItem icon={Check} color="text-success" text={`Correlação baixa (${parlay.avgCorrelation.toFixed(2)})`} />
                    )}
                    {parlay.combinedProbability < 15 && (
                      <RiskItem icon={AlertTriangle} color="text-warning" text={`Probabilidade baixa (${parlay.combinedProbability.toFixed(1)}%)`} />
                    )}
                    <RiskItem icon={AlertTriangle} color="text-warning" text="Variance alta (múltipla)" />
                    <RiskItem icon={Check} color="text-success" text={`Edge agregado positivo (${parlay.avgEdge.toFixed(1)}%)`} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 font-mono text-[10px]" onClick={copyToClipboard}>
              <Copy className="w-3.5 h-3.5" />
              Copiar Seleções
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function MetricBox({ label, value, sublabel, icon: Icon, variant }: {
  label: string;
  value: string;
  sublabel?: string;
  icon: any;
  variant: 'primary' | 'success' | 'warning' | 'accent';
}) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    accent: 'text-accent-foreground bg-accent/30',
  };

  return (
    <div className={`p-2 sm:p-2.5 rounded-lg ${colors[variant]}`}>
      <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
        <Icon className="w-3 h-3" />
        <p className="font-mono text-[9px] sm:text-[10px]">{label}</p>
      </div>
      <p className="font-mono text-[12px] sm:text-sm font-bold">{value}</p>
      {sublabel && <p className="font-mono text-[8px] sm:text-[9px] opacity-70">{sublabel}</p>}
    </div>
  );
}

function AnalysisRow({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'bad' }) {
  const colors = { good: 'text-success', warning: 'text-warning', bad: 'text-destructive' };
  const StatusIcon = status === 'good' ? Check : status === 'warning' ? AlertTriangle : X;

  return (
    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
      <div className="flex items-center gap-1.5">
        <StatusIcon className={`w-3 h-3 ${colors[status]}`} />
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className={`font-mono text-[10px] font-bold ${colors[status]}`}>{value}</span>
    </div>
  );
}

function RiskItem({ icon: Icon, color, text }: { icon: any; color: string; text: string }) {
  return (
    <div className={`flex items-start gap-1.5 ${color}`}>
      <Icon className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span className="font-mono text-[10px]">{text}</span>
    </div>
  );
}
