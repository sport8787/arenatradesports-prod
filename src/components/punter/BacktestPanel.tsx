import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, BarChart3, TrendingUp, TrendingDown, Target, XCircle,
  CheckCircle2, ArrowLeft, Activity, Percent, DollarSign, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import GoldButton from '@/components/game/GoldButton';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

const LEAGUES = [
  { key: 'soccer_brazil_campeonato', label: 'Brasileirão Série A' },
  { key: 'soccer_brazil_serie_b', label: 'Brasileirão Série B' },
  { key: 'soccer_epl', label: 'Premier League' },
  { key: 'soccer_spain_la_liga', label: 'La Liga' },
  { key: 'soccer_italy_serie_a', label: 'Serie A (Itália)' },
  { key: 'soccer_germany_bundesliga', label: 'Bundesliga' },
  { key: 'soccer_france_ligue_one', label: 'Ligue 1' },
  { key: 'soccer_argentina_primera_division', label: 'Argentina Primera' },
  { key: 'soccer_conmebol_copa_libertadores', label: 'Copa Libertadores' },
  { key: 'soccer_uefa_champs_league', label: 'Champions League' },
];

const currentYear = new Date().getFullYear();
const SEASONS = [currentYear - 1, currentYear - 2, currentYear - 3];

interface BacktestMetrics {
  total_analyzed: number;
  total_approved: number;
  approval_rate: number;
  greens: number;
  reds: number;
  hit_rate: number;
  roi_total: number;
  net_profit: number;
  max_drawdown: number;
  final_bankroll: number;
  initial_bankroll: number;
  roi_by_ev: { range: string; count: number; greens: number; reds: number; roi: number; profit_loss: number }[];
  bankroll_curve: { index: number; bankroll: number; date: string }[];
}

interface BacktestResult {
  fixture_id: number;
  date: string;
  round: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  market: string;
  predicted_prob: number;
  implied_prob: number;
  odd: number;
  ev: number;
  value_pct: number;
  verdict: string;
  result: 'green' | 'red' | null;
  stake_pct: number;
  profit_loss: number;
}

interface Props {
  onClose: () => void;
}

export default function BacktestPanel({ onClose }: Props) {
  const [league, setLeague] = useState(LEAGUES[0].key);
  const [season, setSeason] = useState(SEASONS[0]);
  const [minValue, setMinValue] = useState(5);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [showBets, setShowBets] = useState(false);

  const runBacktest = async () => {
    setLoading(true);
    setMetrics(null);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('mycroft-punter-backtest', {
        body: { league, season, min_value: minValue, initial_bankroll: 10000, fixed_stake_pct: 3 }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      setMetrics(data.metrics);
      setResults(data.results || []);
      setLeagueName(data.league);
      toast.success(`Backtest concluído: ${data.metrics.total_approved} apostas simuladas`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar backtest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Activity className="w-5 h-5 text-accent" />
          <h1 className="font-orbitron text-base md:text-lg font-bold text-accent">
            Modo Simulado (Backtest)
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-4xl">
        {/* Config Card */}
        <Card className="border-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-orbitron text-accent">Configurar Simulação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Liga</label>
                <Select value={league} onValueChange={setLeague}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAGUES.map(l => (
                      <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Temporada</label>
                <Select value={String(season)} onValueChange={v => setSeason(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEASONS.map(s => (
                      <SelectItem key={s} value={String(s)}>{s}/{s + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
              <p><strong className="text-accent">Sem Lookahead:</strong> Cada jogo é analisado usando apenas dados acumulados até a rodada anterior. Modelo Poisson adaptativo.</p>
              <p className="mt-1">Banca inicial: R$ 10.000 | Stake fixo: 3% | Min Value: {minValue}%</p>
            </div>

            <GoldButton onClick={runBacktest} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulando temporada...</>
              ) : (
                <><BarChart3 className="mr-2 h-4 w-4" /> Iniciar Backtest</>
              )}
            </GoldButton>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {metrics && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Summary Banner */}
              <Card className={cn("border", metrics.roi_total >= 0 ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{leagueName} — {season}/{season + 1}</p>
                      <p className="text-2xl font-orbitron font-bold mt-1">
                        <span className={metrics.roi_total >= 0 ? 'text-success' : 'text-destructive'}>
                          {metrics.roi_total >= 0 ? '+' : ''}{metrics.roi_total.toFixed(2)}% ROI
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl font-orbitron font-bold", metrics.net_profit >= 0 ? 'text-success' : 'text-destructive')}>
                        {metrics.net_profit >= 0 ? '+' : ''}R$ {metrics.net_profit.toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <MetricBox label="Analisados" value={metrics.total_analyzed} />
                <MetricBox label="Aprovados" value={metrics.total_approved} color="accent" />
                <MetricBox label="Aprovação" value={`${metrics.approval_rate.toFixed(1)}%`} />
                <MetricBox label="Greens" value={metrics.greens} color="success" icon={<CheckCircle2 className="w-3 h-3" />} />
                <MetricBox label="Reds" value={metrics.reds} color="destructive" icon={<XCircle className="w-3 h-3" />} />
                <MetricBox label="Acerto" value={`${metrics.hit_rate.toFixed(1)}%`} color={metrics.hit_rate >= 50 ? 'success' : 'destructive'} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MetricBox label="Banca Final" value={`R$ ${metrics.final_bankroll.toFixed(0)}`} color={metrics.final_bankroll >= metrics.initial_bankroll ? 'success' : 'destructive'} />
                <MetricBox label="Max Drawdown" value={`${metrics.max_drawdown.toFixed(1)}%`} color="warning" icon={<AlertTriangle className="w-3 h-3" />} />
                <MetricBox label="ROI" value={`${metrics.roi_total.toFixed(2)}%`} color={metrics.roi_total >= 0 ? 'success' : 'destructive'} icon={<Percent className="w-3 h-3" />} />
              </div>

              {/* Bankroll Curve */}
              {metrics.bankroll_curve.length > 1 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-orbitron">Curva de Crescimento da Banca</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics.bankroll_curve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="index" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['dataMin - 500', 'dataMax + 500']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                            formatter={(value: number) => [`R$ ${value.toFixed(0)}`, 'Banca']}
                            labelFormatter={(label) => `Aposta #${label}`}
                          />
                          <ReferenceLine y={metrics.initial_bankroll} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Line
                            type="monotone"
                            dataKey="bankroll"
                            stroke="hsl(var(--accent))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ROI by EV Range */}
              {metrics.roi_by_ev.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-orbitron">ROI por Faixa de EV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.roi_by_ev}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                            formatter={(value: number, name: string) => {
                              if (name === 'roi') return [`${value.toFixed(1)}%`, 'ROI'];
                              return [value, name];
                            }}
                          />
                          <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                            {metrics.roi_by_ev.map((entry, i) => (
                              <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-1">
                      {metrics.roi_by_ev.map((ev, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">EV {ev.range}: {ev.count} apostas ({ev.greens}G / {ev.reds}R)</span>
                          <span className={cn("font-bold", ev.roi >= 0 ? 'text-success' : 'text-destructive')}>
                            {ev.roi >= 0 ? '+' : ''}{ev.roi.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Approved Bets List */}
              {results.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-orbitron">Apostas Simuladas ({results.length})</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowBets(!showBets)}>
                      {showBets ? 'Ocultar' : 'Exibir'}
                    </Button>
                  </CardHeader>
                  {showBets && (
                    <CardContent className="max-h-80 overflow-y-auto space-y-1.5">
                      {results.map((r, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg text-xs border",
                            r.result === 'green' ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{r.home_team} {r.home_goals}x{r.away_goals} {r.away_team}</p>
                            <p className="text-muted-foreground">{r.market} • Odd {r.odd} • EV {r.value_pct.toFixed(1)}%</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className={cn("font-orbitron font-bold", r.profit_loss >= 0 ? 'text-success' : 'text-destructive')}>
                              {r.profit_loss >= 0 ? '+' : ''}R$ {r.profit_loss.toFixed(0)}
                            </p>
                            <Badge variant="outline" className={cn("text-[9px]", r.result === 'green' ? 'text-success border-success/30' : 'text-destructive border-destructive/30')}>
                              {r.result === 'green' ? '✅ GREEN' : '❌ RED'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && !metrics && (
          <Card className="border-dashed border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <Activity className="w-12 h-12 text-accent/40 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1 text-foreground">Backtest Histórico</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Simule como o Mycroft Punter teria performado em temporadas passadas. 
                Selecione liga e temporada, depois clique em "Iniciar Backtest".
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  const colorClass = color === 'success' ? 'text-success' :
    color === 'destructive' ? 'text-destructive' :
    color === 'accent' ? 'text-accent' :
    color === 'warning' ? 'text-warning' : 'text-foreground';

  return (
    <div className="bg-secondary/30 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn("font-orbitron font-bold text-sm", colorClass)}>{value}</p>
    </div>
  );
}
