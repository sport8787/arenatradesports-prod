import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Loader2, BarChart3, Calendar, DollarSign, 
  CheckCircle2, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Wallet, ArrowLeft, Brain, Clock, History, TrendingDown, XCircle, Activity, LayoutGrid, FlaskConical,
  Sparkles, User, Bot, Trophy, Award
} from 'lucide-react';
import BacktestPanel from '@/components/punter/BacktestPanel';
import PunterRankings from '@/components/punter/PunterRankings';
import PerformanceCertificate from '@/components/punter/PerformanceCertificate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import GoldButton from '@/components/game/GoldButton';
import DualBankrollDashboard from '@/components/punter/DualBankrollDashboard';
import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
import { calculateAssetScore, getGradeConfig, type AssetScore } from '@/lib/assetScore';
import { calculateKellyStake } from '@/lib/kellyCalculator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PunterSignal {
  match: {
    home_team: string;
    away_team: string;
    commence_time: string;
    league: string;
  };
  recommendation: {
    verdict: string;
    market: string;
    bookmaker: string;
    odd: number;
    fair_odd: number;
    value_percentage: number;
    confidence: number;
    stake_percentage: number;
    thesis: string;
    analysis: string;
    risk_factors: string;
  };
}

export default function PunterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bankroll, loading: bankrollLoading, settleBets, updateInitialBalance } = useBankroll();
  const { bankroll: manualBankroll, loading: manualLoading, placeBet: placeManualBet, updateInitialBalance: updateManualBalance } = useManualBankroll();
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<PunterSignal[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState<'15min' | '48h'>('48h');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyBets, setHistoryBets] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'green' | 'red'>('all');
  const [settlingBets, setSettlingBets] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [autoPlacedMatchIds, setAutoPlacedMatchIds] = useState<Set<string>>(new Set());

  // Set of pending bet match keys for "NOVO" badge
  const pendingMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const bet of pendingBets) {
      keys.add((bet.match_id || '').toLowerCase());
    }
    return keys;
  }, [pendingBets]);

  // Load pending bets on mount
  useEffect(() => {
    const loadPendingBets = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('virtual_bets_punter')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!error && data) setPendingBets(data);
    };
    loadPendingBets();
  }, [user]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from('virtual_bets_punter')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setHistoryBets(data || []);
    setHistoryLoading(false);
  }, [user]);

  const openHistory = () => {
    setIsHistoryOpen(true);
    fetchHistory();
  };

  const handleSettleBets = async () => {
    if (!user) return;
    setSettlingBets(true);

    const result = await settleBets();
    if (!result.success) {
      toast.error(result.error || 'Erro ao liquidar apostas');
      setSettlingBets(false);
      return;
    }

    toast.success('Apostas liquidadas! Histórico e pendências atualizados.');

    const { data } = await supabase
      .from('virtual_bets_punter')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setPendingBets(data || []);

    if (isHistoryOpen) {
      await fetchHistory();
    }

    setSettlingBets(false);
  };

  const fetchSavedSignals = async (): Promise<PunterSignal[]> => {
    const now = new Date().toISOString();
    const { data: savedAnalyses } = await supabase
      .from('punter_analyses')
      .select('*')
      .eq('verdict', 'APROVADO')
      .gt('commence_time', now)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!savedAnalyses || savedAnalyses.length === 0) return [];

    return savedAnalyses.map((a: any) => ({
      match: {
        home_team: a.home_team,
        away_team: a.away_team,
        commence_time: a.commence_time,
        league: a.league,
      },
      recommendation: {
        verdict: a.verdict,
        market: a.market,
        bookmaker: a.bookmaker,
        odd: a.odd,
        fair_odd: a.fair_odd,
        value_percentage: a.value_percentage,
        confidence: a.confidence,
        stake_percentage: a.stake_percentage,
        thesis: a.thesis,
        analysis: a.analysis,
        risk_factors: a.risk_factors,
      },
    }));
  };

  // Auto-place Hórus bet for a single signal (no toast per bet)
  const autoPlaceHorusBet = async (signal: PunterSignal) => {
    if (!bankroll || !user) return false;

    // Kelly Criterion for smart stake sizing
    const estimatedProb = signal.recommendation.confidence || 55;
    const kelly = calculateKellyStake({
      probability: estimatedProb,
      odd: signal.recommendation.odd,
      bankroll: bankroll.balance,
      fraction: 0.25, // 25% Kelly (safe)
      minStake: 1,
      maxStake: 5,
    });

    const stake = kelly.stakeAmount;
    if (stake <= 0 || stake > bankroll.balance) return false;

    const matchName = `${signal.match.home_team} vs ${signal.match.away_team}`;
    const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_');

    // Check if Hórus already bet on this match
    const { data: existingBets } = await supabase
      .from('virtual_bets_punter')
      .select('id')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .eq('status', 'pending');

    if (existingBets && existingBets.length > 0) return false; // Already bet

    const { error: betError } = await supabase
      .from('virtual_bets_punter')
      .insert({
        user_id: user.id,
        match_id: matchId,
        match_name: matchName,
        market: signal.recommendation.market,
        odd: signal.recommendation.odd,
        stake: stake,
        status: 'pending',
        thesis: signal.recommendation.thesis || null,
      } as any);

    if (betError) return false;

    await supabase.from('user_bankroll').update({
      balance: bankroll.balance - stake,
      total_staked: bankroll.total_staked + stake,
      total_bets: bankroll.total_bets + 1,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    // Update local bankroll
    bankroll.balance -= stake;
    bankroll.total_staked += stake;
    bankroll.total_bets += 1;

    return true;
  };

  const analyzeGames = async () => {
    if (!user) {
      setError('Você precisa estar logado para analisar jogos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const savedSignals = await fetchSavedSignals();
      const hoursAhead = timeWindow === '15min' ? 0.25 : 48;
      const functionName = aiProvider === 'anthropic' ? 'mycroft-punter-anthropic' : 'mycroft-punter-analysis';
      const { data, error: fnError } = await supabase.functions.invoke(functionName, {
        body: {
          hours_ahead: hoursAhead,
          bookmakers: ['bet365', 'pinnacle', 'betfair'],
          min_value: 5,
        }
      });

      const newSignals: PunterSignal[] = (data?.signals || []);
      const newAnalyzed = data?.total_analyzed || 0;
      const newApproved = data?.total_approved || 0;

      const signalKey = (s: PunterSignal) =>
        `${s.match.home_team}_${s.match.away_team}_${s.match.commence_time}`.toLowerCase().replace(/\s+/g, '_');

      const mergedMap = new Map<string, PunterSignal>();
      for (const s of savedSignals) mergedMap.set(signalKey(s), s);
      for (const s of newSignals) mergedMap.set(signalKey(s), s);
      const mergedSignals = Array.from(mergedMap.values());

      setSignals(mergedSignals);
      setTotalAnalyzed(newAnalyzed);
      setTotalApproved(mergedSignals.length);

      // Auto-place Hórus bets — robust anti-duplication via fresh DB check
      if (bankroll && mergedSignals.length > 0) {
        // Fetch ALL pending bets fresh from DB to prevent duplicates
        const { data: freshPending } = await supabase
          .from('virtual_bets_punter')
          .select('match_id')
          .eq('user_id', user.id)
          .eq('status', 'pending');
        
        const existingMatchIds = new Set(
          (freshPending || []).map((b: any) => (b.match_id || '').toLowerCase())
        );

        let autoPlaced = 0;
        const newAutoIds = new Set<string>();
        for (const signal of mergedSignals) {
          const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
          // Skip if already has a pending bet (from any source)
          if (existingMatchIds.has(matchId)) continue;
          
          const placed = await autoPlaceHorusBet(signal);
          if (placed) {
            autoPlaced++;
            newAutoIds.add(matchId);
            existingMatchIds.add(matchId); // Prevent within-loop duplicates
          }
        }
        setAutoPlacedMatchIds(newAutoIds);
        if (autoPlaced > 0) {
          toast.success(`🤖 Hórus apostou automaticamente em ${autoPlaced} jogos`);
        }
        // Refresh pending bets
        const { data: updated } = await supabase
          .from('virtual_bets_punter')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (updated) setPendingBets(updated);
      }

      if (fnError) {
        if (savedSignals.length > 0) {
          toast.info(`${savedSignals.length} sinais salvos carregados (nova análise falhou)`);
        } else {
          throw fnError;
        }
      } else {
        const savedOnly = mergedSignals.length - newApproved;
        const msg = savedOnly > 0
          ? `${newApproved} novos + ${savedOnly} salvos = ${mergedSignals.length} sinais (${aiProvider === 'anthropic' ? 'Claude' : 'Gemini'})`
          : `${newApproved} sinais aprovados de ${newAnalyzed} jogos (${aiProvider === 'anthropic' ? 'Claude' : 'Gemini'})`;
        toast.success(msg);
      }
    } catch (err: any) {
      console.error('Erro ao analisar jogos:', err);
      setError(err.message || 'Erro ao conectar com Mycroft Punter');
    } finally {
      setLoading(false);
    }
  };

  const placeBetManual = useCallback(async (signal: PunterSignal, customStake: number) => {
    if (!manualBankroll || !user) {
      toast.error('Bankroll Manual não carregada');
      return;
    }
    if (customStake <= 0) {
      toast.error('Valor da aposta deve ser maior que zero');
      return;
    }
    if (customStake > manualBankroll.balance) {
      toast.error('Saldo insuficiente na Bankroll Manual');
      return;
    }
    const matchName = `${signal.match.home_team} vs ${signal.match.away_team}`;
    const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_');

    const result = await placeManualBet({
      match_id: matchId,
      match_name: matchName,
      market: signal.recommendation.market,
      odd: signal.recommendation.odd,
      stake: customStake,
      thesis: signal.recommendation.thesis,
    });

    if (!result.success) {
      toast.error(result.error || 'Erro');
      return;
    }
    toast.success(`Manual: R$ ${customStake.toFixed(2)} em ${matchName}`);
  }, [manualBankroll, user, placeManualBet]);

  if (showBacktest) return <BacktestPanel onClose={() => setShowBacktest(false)} />;
  if (showRankings) return <PunterRankings onClose={() => setShowRankings(false)} />;
  if (showCertificate && bankroll) return <PerformanceCertificate bankroll={bankroll} onClose={() => setShowCertificate(false)} />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header — Bloomberg-style top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
                ORÁCULO MYCROFT
              </h1>
              <span className="text-[10px] text-muted-foreground font-mono border border-border px-1.5 py-0.5 rounded">
                PUNTER
              </span>
            </div>
          </div>

          {/* Balance ticker */}
          {bankroll && (
            <div className="hidden md:flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">HÓRUS</span>
                <span className="text-foreground font-semibold">
                  R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {manualBankroll && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">MANUAL</span>
                  <span className="text-foreground font-semibold">
                    R$ {manualBankroll.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <HeaderBtn icon={<History className="w-3.5 h-3.5" />} label="Histórico" onClick={openHistory} />
            <HeaderBtn icon={settlingBets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} label="Liquidar" onClick={handleSettleBets} disabled={settlingBets} />
            <HeaderBtn icon={<Activity className="w-3.5 h-3.5" />} label="Backtest" onClick={() => setShowBacktest(true)} />
            <HeaderBtn icon={<Trophy className="w-3.5 h-3.5" />} label="Ranking" onClick={() => setShowRankings(true)} />
            <HeaderBtn icon={<Award className="w-3.5 h-3.5" />} label="Cert." onClick={() => setShowCertificate(true)} />
            <HeaderBtn icon={<Brain className="w-3.5 h-3.5" />} label="KB" onClick={() => setIsChatOpen(true)} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-5xl">
        {/* Dual Bankroll Widget */}
        {bankroll && manualBankroll && !bankrollLoading && !manualLoading && (
          <DualBankrollDashboard
            horus={bankroll}
            manual={manualBankroll}
            onUpdateHorusBalance={updateInitialBalance}
            onUpdateManualBalance={updateManualBalance}
          />
        )}

        {/* Scanner Panel */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scanner de Mercado</h3>
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                Value Betting Pré-Jogo
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={timeWindow === '15min' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeWindow('15min')}
                className="font-mono text-xs"
              >
                <Clock className="w-3 h-3 mr-1.5" />
                15 MIN
              </Button>
              <Button
                variant={timeWindow === '48h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeWindow('48h')}
                className="font-mono text-xs"
              >
                <Calendar className="w-3 h-3 mr-1.5" />
                48H
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={aiProvider === 'gemini' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAiProvider('gemini')}
                className="font-mono text-xs"
              >
                Gemini
              </Button>
              <Button
                variant={aiProvider === 'anthropic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAiProvider('anthropic')}
                className="font-mono text-xs"
              >
                Claude
              </Button>
            </div>

            <GoldButton onClick={analyzeGames} disabled={loading} className="w-full font-mono text-xs tracking-wider">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SCANNING...</>
              ) : (
                <><BarChart3 className="mr-2 h-4 w-4" /> ANALISAR MERCADO</>
              )}
            </GoldButton>

            {totalAnalyzed > 0 && !loading && (
              <div className="flex gap-4 text-xs font-mono border-t border-border pt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">SCANNED</span>
                  <span className="text-foreground font-semibold">{totalAnalyzed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">APPROVED</span>
                  <span className="text-success font-semibold">{totalApproved}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">RATE</span>
                  <span className="text-success font-semibold">
                    {((totalApproved / totalAnalyzed) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analyze Button */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-orbitron">Analisar Jogos (Todas as Ligas + PE)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={timeWindow === '15min' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeWindow('15min')}
                className="flex-1"
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Próximos 15 min
              </Button>
              <Button
                variant={timeWindow === '48h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeWindow('48h')}
                className="flex-1"
              >
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Próximas 48h
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant={aiProvider === 'gemini' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAiProvider('gemini')}
                className="flex-1"
              >
                🧠 Gemini
              </Button>
              <Button
                variant={aiProvider === 'anthropic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAiProvider('anthropic')}
                className="flex-1"
              >
                <FlaskConical className="w-3.5 h-3.5 mr-1" />
                Claude (Teste)
              </Button>
            </div>

            <GoldButton onClick={analyzeGames} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando com {aiProvider === 'anthropic' ? 'Claude' : 'Gemini'}...</>
              ) : (
                <><BarChart3 className="mr-2 h-4 w-4" /> Analisar Jogos ({timeWindow === '15min' ? 'próximos 15 min' : 'próximas 48h'})</>
              )}
            </GoldButton>

            {totalAnalyzed > 0 && !loading && (
              <div className="mt-3 flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Analisados:</span>
                  <Badge variant="secondary">{totalAnalyzed}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Aprovados:</span>
                  <Badge className="bg-success text-success-foreground">{totalApproved}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Taxa:</span>
                  <span className="font-bold text-success">
                    {((totalApproved / totalAnalyzed) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Portfolio Expected ROI Summary */}
        {signals.length > 0 && (
          <div className="space-y-4">
            {(() => {
              const scores = signals.map(s => calculateAssetScore({
                value_percentage: s.recommendation.value_percentage,
                confidence: s.recommendation.confidence,
                odd: s.recommendation.odd,
                bookmaker: s.recommendation.bookmaker,
              }));
              const avgScore = Math.round(scores.reduce((a, s) => a + s.final_score, 0) / scores.length);
              const avgROI = (scores.reduce((a, s) => a + s.expected_roi, 0) / scores.length).toFixed(1);
              const totalPendingStake = pendingBets.reduce((s: number, b: any) => s + parseFloat(b.stake || 0), 0);
              const expectedProfit = pendingBets.reduce((s: number, b: any) => {
                const sig = signals.find(sg => {
                  const mId = `${sg.match.home_team}_${sg.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
                  return mId === (b.match_id || '').toLowerCase();
                });
                if (!sig) return s;
                return s + parseFloat(b.stake || 0) * (sig.recommendation.odd - 1) * (sig.recommendation.confidence / 100);
              }, 0);

              return (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-orbitron font-bold text-sm text-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Portfólio de Apostas em Aberto
                      </h3>
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        {pendingBets.length} ativos
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Score Médio</p>
                        <p className="font-orbitron font-bold text-lg text-foreground">{avgScore}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Edge Médio</p>
                        <p className="font-orbitron font-bold text-lg text-success">+{avgROI}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Exposição</p>
                        <p className="font-orbitron font-bold text-lg text-foreground">R$ {totalPendingStake.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Retorno Esp.</p>
                        <p className="font-orbitron font-bold text-lg text-success">R$ {expectedProfit.toFixed(0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <h2 className="text-lg font-orbitron font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Sinais Aprovados ({signals.length})
            </h2>
            {signals.map((signal, index) => {
              const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
              const hasPendingBet = pendingMatchKeys.has(matchId);
              const wasAutoPlaced = autoPlacedMatchIds.has(matchId);
              const kelly = bankroll ? calculateKellyStake({
                probability: signal.recommendation.confidence || 55,
                odd: signal.recommendation.odd,
                bankroll: bankroll.balance,
                fraction: 0.25,
              }) : null;
              const horusStake = kelly?.stakeAmount || 0;
              const kellyPercent = kelly?.stakePercent || 3;
              return (
                <SignalCard
                  key={index}
                  signal={signal}
                  onPlaceBetManual={(customStake: number) => placeBetManual(signal, customStake)}
                  bankroll={bankroll}
                  manualBankroll={manualBankroll}
                  isNew={!hasPendingBet && !wasAutoPlaced}
                  horusEntered={hasPendingBet || wasAutoPlaced}
                  horusStake={horusStake}
                  kellyPercent={kellyPercent}
                />
              );
            })}
          </div>
        )}

        {/* Empty states */}
        {!loading && signals.length === 0 && totalAnalyzed > 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="pt-6 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1 text-foreground">Nenhum Sinal Aprovado</h3>
              <p className="text-muted-foreground text-sm">
                {totalAnalyzed} jogos analisados, nenhum com value ≥5%. Tente mais tarde.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && signals.length === 0 && totalAnalyzed === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1 text-foreground">Pronto para Começar</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Clique em "Analisar Jogos" para o Mycroft Punter buscar oportunidades de value betting.
                Hórus apostará automaticamente nos sinais aprovados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Bets */}
        {pendingBets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-orbitron font-bold flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-primary" />
              Apostas Pendentes ({pendingBets.length})
            </h2>
            {pendingBets.map((bet) => (
              <Card key={bet.id} className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{bet.match_name}</p>
                        <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          <Bot className="w-3 h-3 mr-0.5" />
                          Hórus
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{bet.market}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-orbitron font-bold text-primary">R$ {parseFloat(bet.stake).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Odd: {bet.odd}</p>
                    </div>
                  </div>
                  <Badge className="mt-2 bg-primary/10 text-primary border-primary/30">Pendente ⏳</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* KB Chat */}
      <MycroftSportsChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Punter History Sheet */}
      <PunterHistorySheet
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        bets={historyBets}
        loading={historyLoading}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
      />
    </div>
  );
}

// Signal Card Component with Asset Score Grade (A+/A/B/C)
function SignalCard({ signal, onPlaceBetManual, bankroll, manualBankroll, isNew, horusEntered, horusStake, kellyPercent }: {
  signal: PunterSignal;
  onPlaceBetManual: (stake: number) => void;
  bankroll: any;
  manualBankroll: any;
  isNew: boolean;
  horusEntered: boolean;
  horusStake: number;
  kellyPercent?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [customStake, setCustomStake] = useState('');
  const commenceDate = new Date(signal.match.commence_time);
  const isToday = commenceDate.toDateString() === new Date().toDateString();
  const stakePercent = kellyPercent || signal.recommendation.stake_percentage || 3;

  const assetScore = calculateAssetScore({
    value_percentage: signal.recommendation.value_percentage,
    confidence: signal.recommendation.confidence,
    odd: signal.recommendation.odd,
    bookmaker: signal.recommendation.bookmaker,
  });
  const gradeConfig = getGradeConfig(assetScore.grade);

  const handleManualBet = () => {
    const stake = parseFloat(customStake);
    if (isNaN(stake) || stake <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    onPlaceBetManual(stake);
    setCustomStake('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn("transition-all", gradeConfig.border, "border hover:shadow-lg")}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {/* Grade Badge - prominent */}
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-orbitron font-bold border",
                  gradeConfig.bg, gradeConfig.text, gradeConfig.border
                )}>
                  {gradeConfig.emoji} {assetScore.grade}
                </span>
                {isNew && (
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px] animate-pulse">
                    <Sparkles className="w-3 h-3 mr-0.5" />
                    NOVO
                  </Badge>
                )}
                {horusEntered && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                    <Bot className="w-3 h-3 mr-0.5" />
                    ENTREI — R$ {horusStake.toFixed(2)}
                  </Badge>
                )}
              </div>

              {/* Match name */}
              <CardTitle className="text-base text-foreground leading-tight">
                {signal.match.home_team} vs {signal.match.away_team}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {isToday ? 'Hoje' : commenceDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {' às '}
                  {commenceDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="opacity-60">•</span>
                <span>{signal.match.league}</span>
              </div>
            </div>

            {/* Score circle */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center",
                gradeConfig.border, gradeConfig.bg
              )}>
                <span className={cn("font-orbitron font-bold text-xl leading-none", gradeConfig.text)}>
                  {assetScore.final_score}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase">Score</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Asset Data Grid — like a financial asset card */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <AssetDataCell label="Mercado" value={signal.recommendation.market} />
            <AssetDataCell label="Casa" value={signal.recommendation.bookmaker} />
            <AssetDataCell label="Odd" value={signal.recommendation.odd?.toFixed(2)} highlight />
            <AssetDataCell label="Prob. Modelo" value={`${assetScore.model_probability}%`} />
            <AssetDataCell label="Edge" value={`+${signal.recommendation.value_percentage?.toFixed(1)}%`} highlight />
            <AssetDataCell label="Stake Kelly" value={`${stakePercent}% (R$ ${horusStake.toFixed(0)})`} />
          </div>

          {/* Classification description */}
          <div className={cn("rounded-lg p-2.5 flex items-center gap-2", gradeConfig.bg, "border", gradeConfig.border)}>
            <span className="text-lg">{gradeConfig.emoji}</span>
            <div>
              <span className={cn("font-orbitron font-bold text-sm", gradeConfig.text)}>
                Classificação {assetScore.grade}
              </span>
              <span className="text-xs text-muted-foreground ml-2">{gradeConfig.label}</span>
            </div>
          </div>

          {/* 5-Factor Score Bars */}
          <div className="space-y-1.5">
            <ScoreBar label="Probabilidade" value={assetScore.probability_score} weight="25%" />
            <ScoreBar label="Market Edge" value={assetScore.edge_score} weight="25%" />
            <ScoreBar label="Força Estatística" value={assetScore.stats_score} weight="20%" />
            <ScoreBar label="Padrão" value={assetScore.pattern_score} weight="15%" />
            <ScoreBar label="Liquidez" value={assetScore.liquidity_score} weight="15%" />
          </div>

          {/* Thesis */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-1">💡 Tese:</p>
            <p className="text-sm text-foreground/80">{signal.recommendation.thesis}</p>
          </div>

          {/* Hórus Auto-bet Info */}
          {horusEntered && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-foreground/80">
                <span className="font-bold text-primary">Hórus apostou automaticamente</span> R$ {horusStake.toFixed(2)} ({stakePercent}% Kelly)
              </p>
            </div>
          )}

          {/* Manual Bet Section */}
          <div className="border border-accent/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-foreground">Aposta Manual</span>
              {manualBankroll && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Saldo: R$ {manualBankroll.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  placeholder="Valor da aposta"
                  value={customStake}
                  onChange={(e) => setCustomStake(e.target.value)}
                  className="pl-9 h-9"
                  min="1"
                  step="0.01"
                />
              </div>
              <Button
                onClick={handleManualBet}
                variant="outline"
                size="sm"
                className="border-accent/30 hover:bg-accent/10 h-9 px-4"
                disabled={!manualBankroll || !customStake}
              >
                <User className="w-3.5 h-3.5 mr-1" />
                Apostar
              </Button>
            </div>
          </div>

          {/* Expand */}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {expanded ? 'Ocultar' : 'Ver'} Análise Completa
          </Button>

          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-2 border-t border-border">
              <div>
                <p className="text-sm font-bold text-foreground mb-1">📊 Análise Detalhada:</p>
                <p className="text-sm text-foreground/80 whitespace-pre-line">{signal.recommendation.analysis}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground mb-1">⚠️ Fatores de Risco:</p>
                <p className="text-sm text-foreground/80 whitespace-pre-line">{signal.recommendation.risk_factors}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-sm font-bold text-foreground mb-1">📐 Cálculo de Value:</p>
                <div className="text-sm text-foreground/80 space-y-1">
                  <div>Odd oferecida: <span className="font-mono">{signal.recommendation.odd}</span> → Prob. implícita: <span className="font-mono">{assetScore.implied_probability}%</span></div>
                  <div>Prob. modelo: <span className="font-mono">{assetScore.model_probability}%</span></div>
                  <div>Odd justa estimada: <span className="font-mono">{signal.recommendation.fair_odd?.toFixed(2) || 'N/A'}</span></div>
                  <div className="font-bold text-success">Value: {signal.recommendation.value_percentage?.toFixed(1)}%</div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const color = value >= 80 ? 'bg-success' : value >= 60 ? 'bg-primary' : value >= 40 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{label} ({weight})</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-orbitron font-bold text-foreground w-7 text-right">{value}</span>
    </div>
  );
}

function AssetDataCell({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg p-2", highlight ? 'bg-success/10 border border-success/20' : 'bg-secondary/30')}>
      <p className="text-[9px] text-muted-foreground uppercase mb-0.5">{label}</p>
      <p className={cn("text-xs font-bold truncate", highlight ? 'text-success' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function HeaderBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// Punter History Sheet
function PunterHistorySheet({ isOpen, onClose, bets, loading, filter, onFilterChange }: {
  isOpen: boolean;
  onClose: () => void;
  bets: any[];
  loading: boolean;
  filter: 'all' | 'pending' | 'green' | 'red';
  onFilterChange: (f: 'all' | 'pending' | 'green' | 'red') => void;
}) {
  const filtered = bets.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending';
    if (filter === 'green') return b.status === 'green' || b.result === 'green';
    if (filter === 'red') return b.status === 'red' || b.result === 'red';
    return true;
  });

  const greens = bets.filter(b => b.status === 'green' || b.result === 'green').length;
  const reds = bets.filter(b => b.status === 'red' || b.result === 'red').length;
  const totalPL = bets.reduce((sum: number, b: any) => sum + (parseFloat(b.profit_loss) || 0), 0);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-orbitron flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico Punter
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-orbitron font-bold text-foreground">{bets.length}</p>
            </div>
            <div className="bg-success/10 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Green</p>
              <p className="font-orbitron font-bold text-success">{greens}</p>
            </div>
            <div className="bg-destructive/10 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Red</p>
              <p className="font-orbitron font-bold text-destructive">{reds}</p>
            </div>
            <div className={cn("rounded-lg p-2 text-center", totalPL >= 0 ? 'bg-success/10' : 'bg-destructive/10')}>
              <p className="text-xs text-muted-foreground">P/L</p>
              <p className={cn("font-orbitron font-bold text-sm", totalPL >= 0 ? 'text-success' : 'text-destructive')}>
                R$ {totalPL.toFixed(0)}
              </p>
            </div>
          </div>

          <Tabs value={filter} onValueChange={v => onFilterChange(v as any)}>
            <TabsList className="bg-secondary/50 w-full">
              <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1">Pendentes</TabsTrigger>
              <TabsTrigger value="green" className="flex-1">Green</TabsTrigger>
              <TabsTrigger value="red" className="flex-1">Red</TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma aposta encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((bet: any, i: number) => {
                  const status = bet.result || bet.status;
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "bg-card border rounded-xl p-3 space-y-1.5",
                        status === 'green' ? 'border-success/40' :
                        status === 'red' ? 'border-destructive/40' :
                        'border-border'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-orbitron text-sm font-bold text-foreground truncate max-w-[180px]">
                          {bet.match_name || bet.match_id}
                        </span>
                        {status === 'green' ? (
                          <Badge className="bg-success/20 text-success border-success/30 text-[10px]">GREEN ✅</Badge>
                        ) : status === 'red' ? (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">RED ❌</Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">PENDENTE ⏳</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{bet.market}</span>
                        <span>Odd: {parseFloat(bet.odd).toFixed(2)}</span>
                        <span>R$ {parseFloat(bet.stake).toFixed(2)}</span>
                        <span>{formatDate(bet.created_at)}</span>
                      </div>
                      {bet.profit_loss != null && status !== 'pending' && (
                        <p className={cn(
                          "text-sm font-orbitron font-bold",
                          parseFloat(bet.profit_loss) >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {parseFloat(bet.profit_loss) >= 0 ? '+' : ''}R$ {parseFloat(bet.profit_loss).toFixed(2)}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
