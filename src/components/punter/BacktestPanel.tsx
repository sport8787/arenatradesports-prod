import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, BarChart3, TrendingUp, TrendingDown, Target, XCircle,
  CheckCircle2, ArrowLeft, Activity, Percent, DollarSign, AlertTriangle,
  Dice5, Calendar, Globe, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import GoldButton from '@/components/game/GoldButton';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

const LEAGUES = [
  { key: 'soccer_brazil_campeonato', label: 'Brasileirão Série A' },
  { key: 'soccer_brazil_serie_b', label: 'Brasileirão Série B' },
  { key: 'soccer_brazil_serie_c', label: 'Brasileirão Série C' },
  { key: 'soccer_brazil_copa_do_brasil', label: 'Copa do Brasil' },
  { key: 'soccer_brazil_campeonato_paulista', label: '🏆 Paulistão' },
  { key: 'soccer_brazil_campeonato_carioca', label: '🏆 Carioca' },
  { key: 'soccer_brazil_campeonato_mineiro', label: '🏆 Mineiro' },
  { key: 'soccer_brazil_campeonato_gaucho', label: '🏆 Gaúcho' },
  { key: 'soccer_brazil_campeonato_baiano', label: '🏆 Baiano' },
  { key: 'soccer_brazil_campeonato_paranaense', label: '🏆 Paranaense' },
  { key: 'soccer_brazil_campeonato_catarinense', label: '🏆 Catarinense' },
  { key: 'soccer_brazil_campeonato_pernambucano', label: '🏆 Pernambucano' },
  { key: 'soccer_epl', label: 'Premier League' },
  { key: 'soccer_spain_la_liga', label: 'La Liga' },
  { key: 'soccer_italy_serie_a', label: 'Serie A (Itália)' },
  { key: 'soccer_germany_bundesliga', label: 'Bundesliga' },
  { key: 'soccer_france_ligue_one', label: 'Ligue 1' },
  { key: 'soccer_portugal_primeira_liga', label: 'Primeira Liga (Portugal)' },
  { key: 'soccer_netherlands_eredivisie', label: 'Eredivisie (Holanda)' },
  { key: 'soccer_belgium_first_div', label: 'Pro League (Bélgica)' },
  { key: 'soccer_turkey_super_league', label: 'Süper Lig (Turquia)' },
  { key: 'soccer_argentina_primera_division', label: 'Argentina Primera' },
  { key: 'soccer_mexico_ligamx', label: 'Liga MX (México)' },
  { key: 'soccer_usa_mls', label: 'MLS (EUA)' },
  { key: 'soccer_saudi_pro_league', label: 'Saudi Pro League' },
  { key: 'soccer_conmebol_copa_libertadores', label: 'Copa Libertadores' },
  { key: 'soccer_conmebol_copa_sudamericana', label: 'Copa Sudamericana' },
  { key: 'soccer_conmebol_copa_america', label: 'Copa América' },
  { key: 'soccer_uefa_champs_league', label: 'Champions League' },
  { key: 'soccer_uefa_europa_league', label: 'Europa League' },
  { key: 'soccer_uefa_europa_conference_league', label: 'Conference League' },
  { key: 'soccer_uefa_european_championship', label: 'Eurocopa' },
  { key: 'soccer_fifa_world_cup', label: 'Copa do Mundo' },
];

const DEFAULT_LEAGUES = [
  'soccer_brazil_campeonato',
  'soccer_brazil_serie_b',
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'soccer_france_ligue_one',
  'soccer_conmebol_copa_libertadores',
  'soccer_uefa_champs_league',
];

function getTimeWindows() {
  const today = new Date();
  const todayYmd = today.toISOString().slice(0, 10);

  const d3m = new Date(today);
  d3m.setDate(d3m.getDate() - 90);
  const from3m = d3m.toISOString().slice(0, 10);

  const d12m = new Date(today);
  d12m.setFullYear(d12m.getFullYear() - 1);
  const from12m = d12m.toISOString().slice(0, 10);

  const cap = (yr: number) => `${yr}-12-31` > todayYmd ? todayYmd : `${yr}-12-31`;

  return [
    { key: 'season_2026', label: 'Temporada 2026', dateFrom: '2026-01-01', dateTo: cap(2026) },
    { key: 'season_2025', label: 'Temporada 2025', dateFrom: '2025-01-01', dateTo: cap(2025) },
    { key: 'season_2024', label: 'Temporada 2024', dateFrom: '2024-01-01', dateTo: '2024-12-31' },
    { key: 'last_3m',     label: '3 meses',        dateFrom: from3m,       dateTo: todayYmd },
    { key: 'last_12m',    label: '12 meses',        dateFrom: from12m,      dateTo: todayYmd },
  ];
}

const TIME_WINDOWS = getTimeWindows();

interface BacktestMetrics {
  total_analyzed: number;
  total_approved: number;
  approval_rate: number;
  greens: number;
  reds: number;
  hit_rate: number;
  roi_total: number;
  yield_pct?: number;
  net_profit: number;
  total_staked?: number;
  max_drawdown: number;
  final_bankroll: number;
  initial_bankroll: number;
  avg_odd?: number;
  bets_per_day?: number;
  total_days?: number;
  tier_breakdown: { tier: string; count: number; greens: number; reds: number; hit_rate: number; roi: number; profit_loss: number }[];
  roi_by_market?: { market: string; count: number; greens: number; reds: number; hit_rate: number; roi: number; profit_loss: number; avg_odd: number; used_real_odds_pct: number }[];
  roi_by_odd_range?: { range: string; count: number; greens: number; reds: number; hit_rate: number; roi: number; avg_odd: number }[];
  roi_by_league?: { league: string; count: number; greens: number; reds: number; hit_rate: number; roi: number; profit_loss: number }[];
  bankroll_curve: { index: number; bankroll: number; date: string }[];
  criteria_used?: { min_edge: number; min_confidence: number; min_sample: number; target_approval: string };
}

interface MonteCarloResult {
  simulations: number;
  ruin_risk_pct: number;
  drawdown_avg: number;
  drawdown_max: number;
  roi_min: number;
  roi_avg: number;
  roi_max: number;
  roi_p5: number;
  roi_p25: number;
  roi_p50: number;
  roi_p75: number;
  roi_p95: number;
  final_bankroll_avg: number;
  final_bankroll_p5: number;
  final_bankroll_p95: number;
}

interface GrowthProjection {
  days: number;
  label: string;
  bankroll_conservative: number;
  bankroll_expected: number;
  bankroll_optimistic: number;
}

interface BacktestResult {
  fixture_id: number;
  date: string;
  round: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  league_name?: string;
  market: string;
  predicted_prob: number;
  implied_prob: number;
  odd: number;
  ev: number;
  value_pct: number;
  verdict: string;
  result: 'green' | 'red' | 'push' | 'half_green' | 'half_red' | null;
  stake_pct: number;
  profit_loss: number;
}

interface Props {
  onClose: () => void;
}

export default function BacktestPanel({ onClose }: Props) {
  const MAX_STAKE_CAP = 50000; // Realistic bookmaker limit
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e9) return `R$ ${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `R$ ${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `R$ ${(value / 1e3).toFixed(1)}K`;
    return `R$ ${value.toFixed(0)}`;
  };
  const BANKROLL_PRESETS = [200, 500, 1000, 2000, 5000, 10000, 25000, 50000];
  const AH_LINES = [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1] as const;
  const ahMarketsHome = AH_LINES.map(l => ({ key: `AH Casa ${l > 0 ? '+' : ''}${l}`, label: `AH Casa ${l > 0 ? '+' : ''}${l}` }));
  const ahMarketsAway = AH_LINES.map(l => ({ key: `AH Fora ${l > 0 ? '+' : ''}${l}`, label: `AH Fora ${l > 0 ? '+' : ''}${l}` }));
  const ALL_MARKETS = [
    { key: 'Casa', label: 'Casa (1)' },
    { key: 'Empate', label: 'Empate (X)' },
    { key: 'Fora', label: 'Fora (2)' },
    { key: 'Over 2.5', label: 'Over 2.5' },
    { key: 'Under 2.5', label: 'Under 2.5' },
    { key: 'Over 1.5', label: 'Over 1.5' },
    { key: 'BTTS Sim', label: 'BTTS' },
    ...ahMarketsHome,
    ...ahMarketsAway,
  ];
  const AH_KEYS = [...ahMarketsHome.map(m => m.key), ...ahMarketsAway.map(m => m.key)];
  const DATA_SOURCES = [
    { key: 'auto', label: 'Auto (melhor disponível)' },
    { key: 'sportmonks', label: 'Sportmonks (real)' },
    { key: 'futodds', label: 'Futodds (real)' },
    { key: 'arena_matches', label: 'Arena Matches (DB)' },
    { key: 'api_football', label: 'API-Football' },
  ];
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(DEFAULT_LEAGUES);
  const [selectedWindow, setSelectedWindow] = useState(TIME_WINDOWS[0].key); // default: temporada atual
  const [initialBankroll, setInitialBankroll] = useState(10000);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(ALL_MARKETS.map(m => m.key));
  const [dataSource, setDataSource] = useState<string>('auto');
  const [usedSource, setUsedSource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [growthProjections, setGrowthProjections] = useState<GrowthProjection[]>([]);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [syntheticOddsWarning, setSyntheticOddsWarning] = useState<string | null>(null);
  const [showBets, setShowBets] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'montecarlo' | 'breakdown' | 'bets'>('overview');

  const toggleMarket = (key: string) => {
    setSelectedMarkets(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? [key] : next;
      }
      return [...prev, key];
    });
  };
  const toggleAllMarkets = () => {
    setSelectedMarkets(prev => prev.length === ALL_MARKETS.length ? [ALL_MARKETS[0].key] : ALL_MARKETS.map(m => m.key));
  };

  const allSelected = selectedLeagues.length === LEAGUES.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedLeagues([LEAGUES[0].key]);
    } else {
      setSelectedLeagues(LEAGUES.map(l => l.key));
    }
  };

  const toggleLeague = (key: string) => {
    setSelectedLeagues(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? [key] : next;
      }
      return [...prev, key];
    });
  };

  const runBacktest = async () => {
    setLoading(true);
    setMetrics(null);
    setMonteCarlo(null);
    setGrowthProjections([]);
    setResults([]);
    setUsedSource('');
    try {
      const win = TIME_WINDOWS.find(w => w.key === selectedWindow) ?? TIME_WINDOWS[2];
      const { data, error } = await supabase.functions.invoke('mycroft-punter-backtest', {
        body: {
          leagues: selectedLeagues,
          date_from: win.dateFrom,
          date_to: win.dateTo,
          initial_bankroll: initialBankroll,
          max_stake_amount: MAX_STAKE_CAP,
          markets: selectedMarkets,
          data_source: dataSource,
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      setMetrics(data.metrics);
      setMonteCarlo(data.monte_carlo || null);
      setGrowthProjections(data.growth_projections || []);
      setResults(data.results || []);
      setLeagueName(data.league);
      setSyntheticOddsWarning(data.synthetic_odds_warning || null);
      setUsedSource(data.data_source || '');
      toast.success(`Backtest concluído (${data.data_source || 'fonte ?'}): ${data.metrics.total_approved} entradas simuladas`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar backtest');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'overview', label: 'Resumo', icon: Activity },
    { key: 'montecarlo', label: 'Monte Carlo', icon: Dice5 },
    { key: 'breakdown', label: 'Breakdown', icon: Layers },
    { key: 'bets', label: 'Entradas', icon: Target },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground">Ligas ({selectedLeagues.length}/{LEAGUES.length})</label>
                <button type="button" onClick={toggleAll} className="text-[10px] font-bold text-accent hover:underline">
                  {allSelected ? 'Desmarcar Todas' : '✅ Selecionar Todas'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {LEAGUES.map(l => (
                  <label
                    key={l.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer border transition-colors",
                      selectedLeagues.includes(l.key)
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border bg-secondary/20 text-muted-foreground hover:border-accent/30'
                    )}
                  >
                    <Checkbox checked={selectedLeagues.includes(l.key)} onCheckedChange={() => toggleLeague(l.key)} className="h-3.5 w-3.5" />
                    <span className="truncate">{l.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              <Select value={selectedWindow} onValueChange={setSelectedWindow}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_WINDOWS.map(w => (
                    <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Banca Inicial</label>
              <div className="grid grid-cols-4 gap-1.5">
                {BANKROLL_PRESETS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInitialBankroll(v)}
                    className={cn(
                      "rounded-md px-2 py-2 text-xs font-orbitron font-bold border transition-all",
                      initialBankroll === v
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-secondary/20 text-muted-foreground hover:border-accent/30'
                    )}
                  >
                    {v >= 1000 ? `${(v / 1000)}K` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Markets filter */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <label className="text-xs text-muted-foreground">Mercados ({selectedMarkets.length}/{ALL_MARKETS.length})</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedMarkets(prev => {
                    const allAH = AH_KEYS.every(k => prev.includes(k));
                    return allAH ? prev.filter(k => !AH_KEYS.includes(k)) : Array.from(new Set([...prev, ...AH_KEYS]));
                  })} className="text-[10px] font-bold text-accent hover:underline">
                    {AH_KEYS.every(k => selectedMarkets.includes(k)) ? 'Tirar AH' : '➕ Todos AH'}
                  </button>
                  <button type="button" onClick={toggleAllMarkets} className="text-[10px] font-bold text-accent hover:underline">
                    {selectedMarkets.length === ALL_MARKETS.length ? 'Desmarcar Todos' : '✅ Selecionar Todos'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {ALL_MARKETS.map(m => (
                  <label
                    key={m.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer border transition-colors",
                      selectedMarkets.includes(m.key)
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border bg-secondary/20 text-muted-foreground hover:border-accent/30'
                    )}
                  >
                    <Checkbox checked={selectedMarkets.includes(m.key)} onCheckedChange={() => toggleMarket(m.key)} className="h-3.5 w-3.5" />
                    <span className="truncate">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Data source */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fonte de dados históricos</label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sportmonks/Futodds buscam jogos REAIS encerrados (com placar) por data — modo Auto tenta arena_matches → Sportmonks → Futodds → API-Football.
              </p>
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
              <p><strong className="text-accent">Pipeline:</strong> Backtest No-Lookahead + Monte Carlo (10.000 simulações)</p>
              <p className="mt-1">Banca: R$ {initialBankroll.toLocaleString('pt-BR')} | Stake: conforme nível do entrada | <strong className="text-warning">Limite por entrada: R$ {MAX_STAKE_CAP.toLocaleString('pt-BR')}</strong></p>
              {usedSource && <p className="mt-1 text-[10px]">📡 Última execução usou: <strong className="text-accent">{usedSource}</strong></p>}
              <p className="mt-1 text-[10px]">⚠️ Projeções consideram limite realista de casas de entradas — sem crescimento infinito</p>
            </div>

            <GoldButton onClick={runBacktest} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulando + Monte Carlo...</>
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
              {/* Synthetic Odds Warning */}
              {syntheticOddsWarning && (
                <div className="flex gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <span>{syntheticOddsWarning}</span>
                </div>
              )}
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
                        {metrics.net_profit >= 0 ? '+' : ''}R$ {formatCurrency(metrics.net_profit)}
                      </p>
                      <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                    </div>
                  </div>
                  {monteCarlo && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("text-[10px]", monteCarlo.ruin_risk_pct < 2 ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive')}>
                        🎲 Ruína: {monteCarlo.ruin_risk_pct}%
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">
                        📊 {monteCarlo.simulations.toLocaleString()} simulações
                      </Badge>
                      {metrics.avg_odd && (
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          Odd média: {metrics.avg_odd}
                        </Badge>
                      )}
                      {metrics.bets_per_day && (
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {metrics.bets_per_day} entradas/dia
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-bold transition-all",
                      activeTab === tab.key
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
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
                    <MetricBox label="Banca Final" value={`R$ ${formatCurrency(metrics.final_bankroll)}`} color={metrics.final_bankroll >= metrics.initial_bankroll ? 'success' : 'destructive'} />
                    <MetricBox label="Max Drawdown" value={`${metrics.max_drawdown.toFixed(1)}%`} color="warning" icon={<AlertTriangle className="w-3 h-3" />} />
                    <MetricBox label="Yield" value={`${(metrics.yield_pct || metrics.roi_total).toFixed(2)}%`} color={metrics.roi_total >= 0 ? 'success' : 'destructive'} icon={<Percent className="w-3 h-3" />} />
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
                                labelFormatter={(label) => `Entrada #${label}`}
                              />
                              <ReferenceLine y={metrics.initial_bankroll} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                              <Line type="monotone" dataKey="bankroll" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ROI by Tier */}
                  {metrics.tier_breakdown && metrics.tier_breakdown.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron">ROI por Tipo de Entrada</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.tier_breakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                                formatter={(value: number, name: string) => {
                                  if (name === 'roi') return [`${value.toFixed(1)}%`, 'ROI'];
                                  return [value, name];
                                }}
                              />
                              <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                                {metrics.tier_breakdown.map((entry, i) => (
                                  <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-1">
                          {metrics.tier_breakdown.map((t, i) => {
                            const labelMap: Record<string, string> = { 'Elite': '⚡ SINAL FORTE', 'Forte': '✅ SINAL BOM', 'Valor': '🎯 SINAL MODERADO', 'Tier 1': '⚡ SINAL FORTE', 'Tier 2': '✅ SINAL BOM', 'Tier 3': '🎯 SINAL MODERADO' };
                            const tierLabel = labelMap[t.tier] || t.tier;
                            return (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{tierLabel}: {t.count} entradas ({t.greens}G / {t.reds}R) | Acerto: {t.hit_rate}%</span>
                              <span className={cn("font-bold", t.roi >= 0 ? 'text-success' : 'text-destructive')}>
                                {t.roi >= 0 ? '+' : ''}{t.roi.toFixed(1)}%
                              </span>
                            </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* TAB: Monte Carlo */}
              {activeTab === 'montecarlo' && monteCarlo && (
                <div className="space-y-4">
                  {/* Ruin Risk */}
                  <Card className={cn("border-2", monteCarlo.ruin_risk_pct < 2 ? 'border-success/40 bg-success/5' : monteCarlo.ruin_risk_pct < 5 ? 'border-warning/40 bg-warning/5' : 'border-destructive/40 bg-destructive/5')}>
                    <CardContent className="p-6 text-center">
                      <Dice5 className="w-10 h-10 mx-auto mb-2 text-accent" />
                      <p className="text-xs text-muted-foreground mb-1">Risco de Ruína ({monteCarlo.simulations.toLocaleString()} simulações)</p>
                      <p className={cn("text-4xl font-orbitron font-bold", monteCarlo.ruin_risk_pct < 2 ? 'text-success' : monteCarlo.ruin_risk_pct < 5 ? 'text-warning' : 'text-destructive')}>
                        {monteCarlo.ruin_risk_pct}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {monteCarlo.ruin_risk_pct < 2 ? '✅ Estratégia saudável' : monteCarlo.ruin_risk_pct < 5 ? '⚠️ Risco moderado' : '❌ Risco elevado'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Distribution */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <MetricBox label="ROI Mínimo" value={`${monteCarlo.roi_min.toFixed(1)}%`} color={monteCarlo.roi_min >= 0 ? 'success' : 'destructive'} />
                    <MetricBox label="ROI Médio" value={`${monteCarlo.roi_avg.toFixed(1)}%`} color={monteCarlo.roi_avg >= 0 ? 'success' : 'destructive'} />
                    <MetricBox label="ROI Máximo" value={`${monteCarlo.roi_max.toFixed(1)}%`} color="success" />
                    <MetricBox label="DD Médio" value={`${monteCarlo.drawdown_avg.toFixed(1)}%`} color="warning" />
                    <MetricBox label="DD Máximo" value={`${monteCarlo.drawdown_max.toFixed(1)}%`} color="destructive" />
                    <MetricBox label="Banca Média" value={`R$ ${formatCurrency(monteCarlo.final_bankroll_avg)}`} color="accent" />
                  </div>

                  {/* Percentiles */}
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-orbitron">Distribuição de ROI (Percentis)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[
                          { label: 'P5 (Pior cenário)', value: monteCarlo.roi_p5, desc: '5% chance de ser pior que isso' },
                          { label: 'P25 (Conservador)', value: monteCarlo.roi_p25, desc: '25% chance de ser pior' },
                          { label: 'P50 (Mediana)', value: monteCarlo.roi_p50, desc: 'Resultado mais provável' },
                          { label: 'P75 (Otimista)', value: monteCarlo.roi_p75, desc: '75% chance de ser pior' },
                          { label: 'P95 (Melhor cenário)', value: monteCarlo.roi_p95, desc: '95% chance de ser pior' },
                        ].map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/50">
                            <div>
                              <p className="text-xs font-bold text-foreground">{p.label}</p>
                              <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn("font-orbitron font-bold text-sm", p.value >= 0 ? 'text-success' : 'text-destructive')}>
                                {p.value >= 0 ? '+' : ''}{p.value.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                R$ {formatCurrency(metrics!.initial_bankroll * (1 + p.value / 100))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Growth Projections */}
                  {growthProjections.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Projeção de Crescimento
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground font-bold pb-1 border-b border-border">
                            <span>Período</span>
                            <span className="text-center">Conservador</span>
                            <span className="text-center">Esperado</span>
                            <span className="text-center">Otimista</span>
                          </div>
                          {growthProjections.map((gp, i) => (
                            <div key={i} className="grid grid-cols-4 gap-2 text-xs items-center">
                              <span className="font-bold text-foreground">{gp.label}</span>
                              <span className={cn("text-center font-mono", gp.bankroll_conservative >= metrics!.initial_bankroll ? 'text-success' : 'text-destructive')}>
                                R$ {formatCurrency(gp.bankroll_conservative)}
                              </span>
                              <span className={cn("text-center font-mono font-bold", gp.bankroll_expected >= metrics!.initial_bankroll ? 'text-success' : 'text-destructive')}>
                                R$ {formatCurrency(gp.bankroll_expected)}
                              </span>
                              <span className={cn("text-center font-mono", gp.bankroll_optimistic >= metrics!.initial_bankroll ? 'text-success' : 'text-destructive')}>
                                R$ {formatCurrency(gp.bankroll_optimistic)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3">
                          * Projeções com cap de R$ {MAX_STAKE_CAP.toLocaleString('pt-BR')}/entrada. Taxa: {metrics!.bets_per_day?.toFixed(1) || '?'} entradas/dia. Monte Carlo P25/P50/P75.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* TAB: Breakdown */}
              {activeTab === 'breakdown' && (
                <div className="space-y-4">

                  {/* ── ROI by Market (KEY diagnostic) ── */}
                  {metrics.roi_by_market && metrics.roi_by_market.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron flex items-center gap-2">
                          <Target className="w-4 h-4" /> ROI por Mercado
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            — identifica quais mercados destroem o ROI
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...metrics.roi_by_market].sort((a, b) => b.roi - a.roi)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="market" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                                formatter={(value: number, name: string) => [`${(value as number).toFixed(1)}%`, 'ROI']}
                              />
                              <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                                {[...metrics.roi_by_market].sort((a, b) => b.roi - a.roi).map((entry, i) => (
                                  <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {[...metrics.roi_by_market].sort((a, b) => b.roi - a.roi).map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/50">
                              <div>
                                <p className="text-xs font-bold text-foreground">{m.market}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {m.count} entradas • {m.greens}G/{m.reds}R • Acerto: {m.hit_rate}% • Odd méd: {m.avg_odd}
                                  {m.used_real_odds_pct > 0 && (
                                    <span className="text-cyan-400 ml-1">• {m.used_real_odds_pct}% odds reais</span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={cn("font-orbitron font-bold text-sm", m.roi >= 0 ? 'text-success' : 'text-destructive')}>
                                  {m.roi >= 0 ? '+' : ''}{m.roi.toFixed(1)}%
                                </p>
                                <p className={cn("text-[10px]", m.profit_loss >= 0 ? 'text-success' : 'text-destructive')}>
                                  {m.profit_loss >= 0 ? '+' : ''}R$ {Math.abs(m.profit_loss).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">
                          💡 Mercados consistentemente negativos devem ser desativados no seletor de mercados acima.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* ROI by Odd Range */}
                  {metrics.roi_by_odd_range && metrics.roi_by_odd_range.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron">ROI por Faixa de Odd</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.roi_by_odd_range}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                                formatter={(value: number) => [`${value.toFixed(1)}%`, 'ROI']}
                              />
                              <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                                {metrics.roi_by_odd_range.map((entry, i) => (
                                  <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-1">
                          {metrics.roi_by_odd_range.map((r, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {r.range}: {r.count} entradas ({r.greens}G/{r.reds}R) | Acerto: {r.hit_rate}% | Odd média: {r.avg_odd}
                              </span>
                              <span className={cn("font-bold", r.roi >= 0 ? 'text-success' : 'text-destructive')}>
                                {r.roi >= 0 ? '+' : ''}{r.roi.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ROI by League */}
                  {metrics.roi_by_league && metrics.roi_by_league.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron flex items-center gap-2">
                          <Globe className="w-4 h-4" /> ROI por Liga
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {metrics.roi_by_league
                            .sort((a, b) => b.roi - a.roi)
                            .map((l, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/50">
                                <div>
                                  <p className="text-xs font-bold text-foreground">{l.league}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {l.count} entradas • {l.greens}G / {l.reds}R • Acerto: {l.hit_rate}%
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={cn("font-orbitron font-bold text-sm", l.roi >= 0 ? 'text-success' : 'text-destructive')}>
                                    {l.roi >= 0 ? '+' : ''}{l.roi.toFixed(1)}%
                                  </p>
                                  <p className={cn("text-[10px]", l.profit_loss >= 0 ? 'text-success' : 'text-destructive')}>
                                    {l.profit_loss >= 0 ? '+' : ''}R$ {formatCurrency(l.profit_loss)}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tier breakdown */}
                  {metrics.tier_breakdown && metrics.tier_breakdown.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-orbitron">ROI por Tier</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {metrics.tier_breakdown.map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/50">
                              <div>
                                <p className="text-xs font-bold text-foreground">{t.tier}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {t.count} entradas • {t.greens}G / {t.reds}R • Acerto: {t.hit_rate}%
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={cn("font-orbitron font-bold text-sm", t.roi >= 0 ? 'text-success' : 'text-destructive')}>
                                  {t.roi >= 0 ? '+' : ''}{t.roi.toFixed(1)}%
                                </p>
                                <p className={cn("text-[10px]", t.profit_loss >= 0 ? 'text-success' : 'text-destructive')}>
                                  {t.profit_loss >= 0 ? '+' : ''}R$ {formatCurrency(t.profit_loss)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* TAB: Bets */}
              {activeTab === 'bets' && results.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-orbitron">Entradas Simuladas ({results.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[60vh] overflow-y-auto space-y-1.5">
                    {results.map((r, i) => {
                      const isWin = r.result === 'green' || r.result === 'half_green';
                      const isLoss = r.result === 'red' || r.result === 'half_red';
                      const isPush = r.result === 'push';
                      const label = r.result === 'green' ? '✅ GREEN'
                        : r.result === 'half_green' ? '½ GREEN'
                        : r.result === 'push' ? '➖ PUSH'
                        : r.result === 'half_red' ? '½ RED'
                        : '❌ RED';
                      const tone = isWin ? 'success' : isLoss ? 'destructive' : 'muted-foreground';
                      return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg text-xs border",
                          isWin ? 'border-success/30 bg-success/5'
                            : isPush ? 'border-muted bg-muted/10'
                            : 'border-destructive/30 bg-destructive/5'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground truncate">{r.home_team} {r.home_goals}x{r.away_goals} {r.away_team}</p>
                          <p className="text-muted-foreground">{r.market} • Odd {r.odd} • EV {r.value_pct.toFixed(1)}%</p>
                          {r.league_name && <p className="text-[10px] text-muted-foreground/70">{r.league_name}</p>}
                        </div>
                        <div className="text-right ml-2">
                          <p className={cn("font-orbitron font-bold", r.profit_loss > 0 ? 'text-success' : r.profit_loss < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                            {r.profit_loss >= 0 ? '+' : ''}R$ {r.profit_loss.toFixed(0)}
                          </p>
                          <Badge variant="outline" className={cn("text-[9px]", `text-${tone} border-${tone}/30`)}>
                            {label}
                          </Badge>
                        </div>
                      </div>
                      );
                    })}
                  </CardContent>
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
              <h3 className="font-bold text-lg mb-1 text-foreground">Backtest + Monte Carlo</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Simule como o Mycroft Punter teria performado em temporadas passadas,
                com análise de risco Monte Carlo (10.000 simulações) e projeções de crescimento.
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
