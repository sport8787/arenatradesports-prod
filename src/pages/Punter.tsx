import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Loader2, BarChart3, Calendar, DollarSign, 
  CheckCircle2, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Wallet, ArrowLeft, Brain, Clock, History, TrendingDown, XCircle, Activity, LayoutGrid, FlaskConical,
  Sparkles, User, Bot, Trophy, Award, Upload, Settings, Zap
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
import DailySummaryWidget from '@/components/punter/DailySummaryWidget';

import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
import { calculateAssetScore, getGradeConfig, type AssetScore } from '@/lib/assetScore';
import { calculateKellyStake } from '@/lib/kellyCalculator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { playHorusTrigger, playHorusTTS, buildAnalysisResultPhrase } from '@/services/horusPunterVoiceService';
import { useCachedOdds, CachedGame } from '@/hooks/useCachedOdds';
import { useAdmin } from '@/hooks/useAdmin';

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
    simulated_odds?: boolean;
  };
}

export default function PunterPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { bankroll, loading: bankrollLoading, settleBets, updateInitialBalance } = useBankroll();
  const { bankroll: manualBankroll, loading: manualLoading, placeBet: placeManualBet, updateInitialBalance: updateManualBalance } = useManualBankroll();
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<PunterSignal[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [manualPendingBets, setManualPendingBets] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState<'15min' | '48h'>('48h');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isManualHistoryOpen, setIsManualHistoryOpen] = useState(false);
  const [historyBets, setHistoryBets] = useState<any[]>([]);
  const [manualHistoryBets, setManualHistoryBets] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'green' | 'red'>('all');
  const [manualHistoryFilter, setManualHistoryFilter] = useState<'all' | 'pending' | 'green' | 'red'>('all');
  const [settlingBets, setSettlingBets] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [autoPlacedMatchIds, setAutoPlacedMatchIds] = useState<Set<string>>(new Set());
  
  // Cached odds - loaded from daily cron (no API call on user access)
  const { games: cachedGames, loading: cachedLoading, lastFetched, isEmpty: cacheEmpty } = useCachedOdds();
  const ANALYSIS_NT_COST = 50; // NT cost per analysis run

  // Set of pending bet match keys for "NOVO" badge
  const pendingMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const bet of pendingBets) {
      keys.add((bet.match_id || '').toLowerCase());
    }
    return keys;
  }, [pendingBets]);

  // Load pending bets AND saved approved signals on mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;

      // Load pending bets (Hórus + Manual)
      const [horusRes, manualRes] = await Promise.all([
        supabase
          .from('virtual_bets_punter')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('virtual_bets_manual')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);
      if (!horusRes.error && horusRes.data) setPendingBets(horusRes.data);
      if (!manualRes.error && manualRes.data) setManualPendingBets(manualRes.data);

      // Auto-load saved approved signals from DB (from automated cron or previous analyses)
      try {
        const savedSignals = await fetchSavedSignals();
        if (savedSignals.length > 0) {
          setSignals(savedSignals);
          setTotalApproved(savedSignals.length);

          // Auto-place Hórus bets for signals that don't have bets yet
          if (bankroll && bankroll.balance > 0) {
            const pendingIds = new Set(
              (horusRes.data || []).map((b: any) => (b.match_id || '').toLowerCase())
            );
            let autoPlaced = 0;
            const newAutoIds = new Set<string>();
            for (const signal of savedSignals) {
              const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
              if (pendingIds.has(matchId)) continue;
              const placed = await autoPlaceHorusBet(signal);
              if (placed) {
                autoPlaced++;
                newAutoIds.add(matchId);
                pendingIds.add(matchId);
              }
            }
            if (autoPlaced > 0) {
              setAutoPlacedMatchIds(newAutoIds);
              toast.success(`🤖 Hórus apostou automaticamente em ${autoPlaced} jogos`);
              // Refresh pending bets after auto-placing
              const { data: refreshed } = await supabase
                .from('virtual_bets_punter')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
              if (refreshed) setPendingBets(refreshed);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load saved signals:', e);
      }
    };
    loadInitialData();
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

  const fetchManualHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from('virtual_bets_manual')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setManualHistoryBets(data || []);
    setHistoryLoading(false);
  }, [user]);

  const openHistory = () => {
    setIsHistoryOpen(true);
    fetchHistory();
  };

  const openManualHistory = () => {
    setIsManualHistoryOpen(true);
    fetchManualHistory();
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
    const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();

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
        commence_time: signal.match.commence_time || null,
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

    // Charge NT for analysis - fetch fresh balance from DB to avoid stale state
    let ntBalance = profile?.nt_balance || 0;
    try {
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('nt_balance')
        .eq('user_id', user.id)
        .single();
      if (freshProfile) {
        ntBalance = freshProfile.nt_balance;
      }
    } catch (e) {
      console.error('Error fetching fresh NT balance:', e);
    }
    if (ntBalance < ANALYSIS_NT_COST) {
      toast.error(`⚡ Saldo insuficiente! Você precisa de ${ANALYSIS_NT_COST} NT para analisar. Saldo: ${ntBalance} NT`);
      return;
    }

    // Deduct NT
    const { data: spentOk, error: spendErr } = await supabase.rpc('spend_nt_balance', {
      p_user_id: user.id,
      p_amount: ANALYSIS_NT_COST,
    });
    if (spendErr || spentOk === false) {
      toast.error('Falha ao debitar NT. Tente novamente.');
      return;
    }
    toast.info(`⚡ -${ANALYSIS_NT_COST} NT debitados para análise`);
    // Refresh profile to sync NT balance in UI
    refetchProfile();

    setLoading(true);
    setError(null);

    // 🔊 Hórus announces analysis start (local audio, no API call)
    playHorusTrigger('analisando_jogos');

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
          // 🔊 Hórus provocation after auto-betting
          setTimeout(() => playHorusTrigger('provocacao'), 2000);
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

        // 🔊 Hórus TTS: announce results with user's name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .single();
        const username = profileData?.username || 'Jogador';
        const ttsPhrase = buildAnalysisResultPhrase(username, newAnalyzed, mergedSignals.length);
        playHorusTTS(ttsPhrase);
      }
    } catch (err: any) {
      console.error('Erro ao analisar jogos:', err);
      setError(err.message || 'Erro ao conectar com Mycroft Punter');
      // 🔊 Play alert audio on error
      playHorusTrigger('alerta');
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
      commence_time: signal.match.commence_time || undefined,
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
                  <span className="text-muted-foreground">MINHA BANCA</span>
                  <span className="text-foreground font-semibold">
                    R$ {manualBankroll.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <HeaderBtn icon={<Bot className="w-3.5 h-3.5" />} label="Posições Hórus" onClick={openHistory} />
            <HeaderBtn icon={<User className="w-3.5 h-3.5" />} label="Minhas Posições" onClick={openManualHistory} />
            <HeaderBtn icon={settlingBets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} label="Liquidar" onClick={handleSettleBets} disabled={settlingBets} />
            <HeaderBtn icon={<Activity className="w-3.5 h-3.5" />} label="Backtest" onClick={() => setShowBacktest(true)} />
            <HeaderBtn icon={<Trophy className="w-3.5 h-3.5" />} label="Ranking" onClick={() => setShowRankings(true)} />
            <HeaderBtn icon={<Award className="w-3.5 h-3.5" />} label="Cert." onClick={() => setShowCertificate(true)} />
            {isAdmin && <HeaderBtn icon={<Brain className="w-3.5 h-3.5" />} label="KB" onClick={() => setIsChatOpen(true)} />}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-5xl">
        {/* Dual Bankroll Widget */}
        {bankroll && manualBankroll && !bankrollLoading && !manualLoading && (
          <DualBankrollDashboard
            horus={bankroll}
            manual={manualBankroll}
            horusPendingBets={pendingBets}
            manualPendingBets={manualPendingBets}
            onUpdateHorusBalance={updateInitialBalance}
            onUpdateManualBalance={updateManualBalance}
          />
        )}

        {/* Daily Summary Widget */}
        {user && <DailySummaryWidget userId={user.id} username={profile?.username} />}

        {/* Navigation Links */}
        <div className="space-y-2">
          <button
            onClick={() => navigate('/punter/analytics')}
            className="w-full border border-border rounded-lg bg-card p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="font-mono text-xs font-semibold text-foreground">Análise Detalhada</p>
                <p className="font-mono text-[10px] text-muted-foreground">Comparativo, horários, config Hórus, oportunidades</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:text-foreground transition-colors" />
          </button>

          <button
            onClick={() => navigate('/punter/import')}
            className="w-full border border-border rounded-lg bg-card p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Upload className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="font-mono text-xs font-semibold text-foreground">Importar & Análise</p>
                <p className="font-mono text-[10px] text-muted-foreground">Importar apostas, ROI, P&L, comparativo de banca</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:text-foreground transition-colors" />
          </button>

          <button
            onClick={() => navigate('/punter/multiplas')}
            className="w-full border border-border rounded-lg bg-card p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="font-mono text-xs font-semibold text-foreground">Multi-Bet Optimizer</p>
                <p className="font-mono text-[10px] text-muted-foreground">Múltiplas otimizadas por IA — correlação, Kelly, edge agregado</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded">BETA</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:text-foreground transition-colors" />
            </div>
          </button>

          <button
            onClick={() => navigate('/punter/config')}
            className="w-full border border-border rounded-lg bg-card p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="font-mono text-xs font-semibold text-foreground">Configurações</p>
                <p className="font-mono text-[10px] text-muted-foreground">Betfair, alertas Hórus, conexões</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:text-foreground transition-colors" />
          </button>
        </div>

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

            {isAdmin && (
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
            )}

            {isAdmin && (
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
            )}

            <GoldButton onClick={analyzeGames} disabled={loading} className="w-full font-mono text-xs tracking-wider">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SCANNING...</>
              ) : (
                <><BarChart3 className="mr-2 h-4 w-4" /> ANALISAR MERCADO ({ANALYSIS_NT_COST} NT)</>
              )}
            </GoldButton>

            {/* Cached games info */}
            {!cachedLoading && cachedGames.length > 0 && (
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border border-border/50 rounded px-2.5 py-1.5 bg-muted/20">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>{cachedGames.length} jogos em cache</span>
                </div>
                {lastFetched && (
                  <span>Atualizado: {new Date(lastFetched).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            )}
            {!cachedLoading && cacheEmpty && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-400 border border-yellow-400/30 rounded px-2.5 py-1.5 bg-yellow-400/5">
                <AlertCircle className="w-3 h-3" />
                <span>Cache vazio — a próxima atualização automática é às 06:00 BRT</span>
              </div>
            )}

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
                <div className="border border-border rounded-lg bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">PORTFÓLIO EM ABERTO</span>
                    <span className="font-mono text-[10px] text-primary">{pendingBets.length} POSIÇÕES</span>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-border">
                    <PortfolioMetric label="SCORE MÉDIO" value={String(avgScore)} />
                    <PortfolioMetric label="EDGE MÉDIO" value={`+${avgROI}%`} valueColor="text-success" />
                    <PortfolioMetric label="EXPOSIÇÃO" value={`R$ ${totalPendingStake.toFixed(0)}`} />
                    <PortfolioMetric label="RETORNO ESP." value={`R$ ${expectedProfit.toFixed(0)}`} valueColor="text-success" />
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                ATIVOS IDENTIFICADOS ({signals.length})
              </h2>
              <div className="flex items-center gap-1 text-[10px] font-mono text-success">
                <CheckCircle2 className="w-3 h-3" />
                APROVADOS
              </div>
            </div>
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
              const kellyStake = kelly?.stakeAmount || 0;
              const kellyPercent = kelly?.stakePercent || 3;

              // Get real bet stake from pending bets if Hórus already entered
              const realBet = pendingBets.find((b: any) => (b.match_id || '').toLowerCase() === matchId);
              const realHorusStake = realBet ? parseFloat(realBet.stake) : kellyStake;
              const realBetDate = realBet ? new Date(realBet.created_at) : null;

              return (
                <SignalCard
                  key={index}
                  signal={signal}
                  onPlaceBetManual={(customStake: number) => placeBetManual(signal, customStake)}
                  bankroll={bankroll}
                  manualBankroll={manualBankroll}
                  isNew={!hasPendingBet && !wasAutoPlaced}
                  horusEntered={hasPendingBet || wasAutoPlaced}
                  horusStake={realHorusStake}
                  horusBetDate={realBetDate}
                  kellyPercent={kellyPercent}
                />
              );
            })}
          </div>
        )}

        {/* Empty states */}
        {!loading && signals.length === 0 && totalAnalyzed > 0 && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-mono text-sm text-foreground mb-1">Nenhum ativo aprovado</p>
            <p className="font-mono text-xs text-muted-foreground">
              {totalAnalyzed} mercados escaneados. Nenhum com edge ≥5%.
            </p>
          </div>
        )}

        {!loading && signals.length === 0 && totalAnalyzed === 0 && (
          <div className="space-y-4">
            {/* Cached Games Preview */}
            {cachedGames.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                    JOGOS DISPONÍVEIS ({cachedGames.length})
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Cache automático — clique "Analisar" para IA
                  </span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-[400px] overflow-y-auto">
                  {cachedGames.slice(0, 30).map((game) => {
                    const commenceDate = new Date(game.commence_time);
                    const isToday = commenceDate.toDateString() === new Date().toDateString();
                    const bookmakerCount = game.bookmakers?.length || 0;
                    return (
                      <div key={game.id} className="p-2.5 flex items-center justify-between bg-card hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-1 h-8 rounded-full", game.simulated_odds ? "bg-yellow-500/50" : "bg-success/50")} />
                          <div>
                            <p className="font-mono text-xs font-medium text-foreground">
                              {game.home_team} vs {game.away_team}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {game.sport_key.replace('soccer_', '').replace(/_/g, ' ')}
                              {game.simulated_odds && <span className="ml-1 text-yellow-500">(odds simuladas)</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[10px] text-foreground">
                            {isToday ? 'Hoje' : commenceDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            {' '}
                            {commenceDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {bookmakerCount} casa{bookmakerCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {cachedGames.length > 30 && (
                    <div className="p-2 text-center text-[10px] font-mono text-muted-foreground">
                      + {cachedGames.length - 30} jogos adicionais
                    </div>
                  )}
                </div>
              </div>
            )}

            {cachedGames.length === 0 && (
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="font-mono text-sm text-foreground mb-1">Pronto para escanear</p>
                <p className="font-mono text-xs text-muted-foreground max-w-sm mx-auto">
                  Clique em "Analisar Mercado" para identificar oportunidades de value betting ({ANALYSIS_NT_COST} NT).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pending Positions */}
        {pendingBets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                POSIÇÕES ABERTAS ({pendingBets.length})
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-primary">
                <Clock className="w-3 h-3" />
                PENDENTE
              </div>
            </div>
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {pendingBets.map((bet) => {
                const betMatchId = (bet.match_id || '').toLowerCase();
                const isNewBet = autoPlacedMatchIds.has(betMatchId);
                const betDate = bet.created_at ? new Date(bet.created_at) : null;
                return (
                  <div key={bet.id} className={cn(
                    "p-3 flex items-center justify-between bg-card hover:bg-secondary/20 transition-colors",
                    isNewBet && "bg-success/5 border-l-2 border-l-success"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-1.5 h-8 rounded-full", isNewBet ? "bg-success" : "bg-primary/50")} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-foreground">{bet.match_name || bet.match_id}</p>
                          {isNewBet && <span className="text-[9px] font-mono font-bold text-success animate-pulse">● NOVA</span>}
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {bet.market}
                          {betDate && (
                            <span className="ml-2 opacity-60">
                              {betDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {betDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-foreground">R$ {parseFloat(bet.stake).toFixed(2)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">@ {parseFloat(bet.odd).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* KB Chat */}
      <MycroftSportsChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Hórus History Sheet */}
      <BetHistorySheet
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        bets={historyBets}
        loading={historyLoading}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
        title="POSIÇÕES DO HÓRUS"
        icon={<Bot className="w-4 h-4 text-primary" />}
        initialBalance={bankroll?.initial_balance || 10000}
        detailLink="/apostas"
      />

      {/* Manual History Sheet */}
      <BetHistorySheet
        isOpen={isManualHistoryOpen}
        onClose={() => setIsManualHistoryOpen(false)}
        bets={manualHistoryBets}
        loading={historyLoading}
        filter={manualHistoryFilter}
        onFilterChange={setManualHistoryFilter}
        title="MINHAS POSIÇÕES"
        icon={<User className="w-4 h-4 text-accent" />}
        initialBalance={manualBankroll?.initial_balance || 10000}
        detailLink="/minhas-apostas"
      />
    </div>
  );
}

// Signal Card Component with Asset Score Grade (A+/A/B/C)
function SignalCard({ signal, onPlaceBetManual, bankroll, manualBankroll, isNew, horusEntered, horusStake, horusBetDate, kellyPercent }: {
  signal: PunterSignal;
  onPlaceBetManual: (stake: number) => void;
  bankroll: any;
  manualBankroll: any;
  isNew: boolean;
  horusEntered: boolean;
  horusStake: number;
  horusBetDate?: Date | null;
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
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className={cn("border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/30", gradeConfig.border)}>
        {/* Top bar with grade + status */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border",
              gradeConfig.bg, gradeConfig.text, gradeConfig.border
            )}>
              {gradeConfig.emoji} {assetScore.grade}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{gradeConfig.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {signal.recommendation.simulated_odds && (
              <span className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded">
                ⚠️ ODDS SIMULADAS
              </span>
            )}
            {isNew && (
              <span className="text-[10px] font-mono text-accent animate-pulse">● NOVO</span>
            )}
            {horusEntered && (
              <span className="text-[10px] font-mono text-primary">
                ✓ HÓRUS R$ {horusStake.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Match Header */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-bold text-foreground leading-tight">
                {signal.match.home_team} vs {signal.match.away_team}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                <span>
                  {isToday ? 'HOJE' : commenceDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
                  {' '}
                  {commenceDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="opacity-40">|</span>
                <span>{signal.match.league}</span>
              </div>
            </div>

            {/* Score badge */}
            <div className={cn(
              "w-14 h-14 rounded-lg border flex flex-col items-center justify-center shrink-0",
              gradeConfig.border, gradeConfig.bg
            )}>
              <span className={cn("font-mono font-bold text-lg leading-none", gradeConfig.text)}>
                {assetScore.final_score}
              </span>
              <span className="text-[7px] font-mono text-muted-foreground uppercase mt-0.5">SCORE</span>
            </div>
          </div>

          {/* Data Grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            <DataCell label="MERCADO" value={signal.recommendation.market} />
            <DataCell label="CASA" value={signal.recommendation.bookmaker} />
            <DataCell label="ODD" value={signal.recommendation.odd?.toFixed(2)} highlight />
            <DataCell label="PROB." value={`${assetScore.model_probability}%`} />
            <DataCell label="EDGE" value={signal.recommendation.value_percentage != null ? `+${signal.recommendation.value_percentage.toFixed(1)}%` : 'N/A'} highlight />
            <DataCell label="KELLY" value={`${stakePercent}% · R$${horusStake.toFixed(0)}`} />
          </div>

          {/* Factor Bars */}
          <div className="space-y-1">
            <FactorBar label="PROB" value={assetScore.probability_score} weight={25} />
            <FactorBar label="EDGE" value={assetScore.edge_score} weight={25} />
            <FactorBar label="STATS" value={assetScore.stats_score} weight={20} />
            <FactorBar label="PADRÃO" value={assetScore.pattern_score} weight={15} />
            <FactorBar label="LIQ" value={assetScore.liquidity_score} weight={15} />
          </div>

          {/* Thesis */}
          <div className="bg-secondary/30 rounded p-3 border-l-2 border-primary/30">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">TESE DE INVESTIMENTO</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{signal.recommendation.thesis}</p>
          </div>

          {/* Hórus Status */}
          {horusEntered && (
            <div className="bg-primary/5 border border-primary/15 rounded p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[10px] font-mono text-foreground/70 truncate">
                  <span className="text-primary font-semibold">POSIÇÃO ABERTA</span> · {horusBetDate ? horusBetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'} · R$ {horusStake.toFixed(2)} ({stakePercent}% Kelly)
                </p>
              </div>
              <button
                onClick={() => {
                  setCustomStake(horusStake.toFixed(2));
                  toast.success(`Valor R$ ${horusStake.toFixed(2)} copiado`);
                }}
                className="text-[9px] font-mono text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors shrink-0"
              >
                COPIAR VALOR
              </button>
            </div>
          )}

          {/* Manual Entry */}
          <div className="border border-border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">ENTRADA MANUAL</span>
              {manualBankroll && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  R$ {manualBankroll.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">R$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={customStake}
                  onChange={(e) => setCustomStake(e.target.value)}
                  className="pl-8 h-8 font-mono text-xs"
                  min="1"
                  step="0.01"
                />
              </div>
              <Button
                onClick={handleManualBet}
                variant="outline"
                size="sm"
                className="h-8 px-3 font-mono text-xs"
                disabled={!manualBankroll || !customStake}
              >
                APOSTAR
              </Button>
            </div>
          </div>

          {/* Expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {expanded ? '▲ OCULTAR ANÁLISE' : '▼ ANÁLISE COMPLETA'}
          </button>

          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-2 border-t border-border">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">ANÁLISE DETALHADA</p>
                <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{signal.recommendation.analysis}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">FATORES DE RISCO</p>
                <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{signal.recommendation.risk_factors}</p>
              </div>
              <div className="bg-secondary/20 border border-border rounded p-3 space-y-1 font-mono text-xs">
                <p className="text-[10px] text-muted-foreground mb-1.5">CÁLCULO DE VALUE</p>
                <div className="text-foreground/80">Odd: <span className="text-foreground">{signal.recommendation.odd}</span> → Implícita: <span className="text-foreground">{assetScore.implied_probability}%</span></div>
                <div className="text-foreground/80">Prob. Modelo: <span className="text-foreground">{assetScore.model_probability}%</span></div>
                <div className="text-foreground/80">Fair Odd: <span className="text-foreground">{signal.recommendation.fair_odd?.toFixed(2) || 'N/A'}</span></div>
                <div className="text-success font-bold">Value: {signal.recommendation.value_percentage != null ? `+${signal.recommendation.value_percentage.toFixed(1)}%` : 'N/A'}</div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FactorBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = value >= 80 ? 'bg-success' : value >= 60 ? 'bg-primary' : value >= 40 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-muted-foreground w-16 shrink-0">{label} ({weight}%)</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] font-mono font-bold text-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function DataCell({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn("rounded p-1.5", highlight ? 'bg-success/5 border border-success/15' : 'bg-secondary/20')}>
      <p className="text-[8px] font-mono text-muted-foreground">{label}</p>
      <p className={cn("text-[11px] font-mono font-semibold truncate", highlight ? 'text-success' : 'text-foreground')}>{value}</p>
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

function PortfolioMetric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[9px] font-mono text-muted-foreground tracking-wider">{label}</p>
      <p className={cn("font-mono font-bold text-sm mt-0.5", valueColor || 'text-foreground')}>{value}</p>
    </div>
  );
}

// Bet History Sheet with Score + Cumulative ROI
function BetHistorySheet({ isOpen, onClose, bets, loading, filter, onFilterChange, title, icon, initialBalance, detailLink }: {
  isOpen: boolean;
  onClose: () => void;
  bets: any[];
  loading: boolean;
  filter: 'all' | 'pending' | 'green' | 'red';
  onFilterChange: (f: 'all' | 'pending' | 'green' | 'red') => void;
  title: string;
  icon: React.ReactNode;
  initialBalance: number;
  detailLink?: string;
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
  const cumulativeROI = initialBalance > 0 ? (totalPL / initialBalance * 100) : 0;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getScoreGrade = (odd: number, confidence?: number) => {
    const score = calculateAssetScore({
      value_percentage: confidence || 60,
      confidence: confidence || 65,
      odd: odd,
      bookmaker: 'default',
    });
    return { score: score.final_score, grade: score.grade, config: getGradeConfig(score.grade) };
  };

  // Calculate cumulative ROI per bet (sorted by date asc)
  const sortedBets = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let runningPL = 0;
  const cumulativeMap = new Map<string, number>();
  for (const bet of sortedBets) {
    runningPL += parseFloat(bet.profit_loss) || 0;
    cumulativeMap.set(bet.id, initialBalance > 0 ? (runningPL / initialBalance * 100) : 0);
  }

  const navigate = useNavigate();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">{icon}{title}</span>
            {detailLink && (
              <button
                onClick={() => { onClose(); navigate(detailLink); }}
                className="text-[10px] font-mono text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
              >
                Análise Detalhada →
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-secondary/30 rounded p-2 text-center">
              <p className="text-[9px] font-mono text-muted-foreground">TOTAL</p>
              <p className="font-mono font-bold text-foreground">{bets.length}</p>
            </div>
            <div className="bg-success/5 rounded p-2 text-center">
              <p className="text-[9px] font-mono text-muted-foreground">GREEN</p>
              <p className="font-mono font-bold text-success">{greens}</p>
            </div>
            <div className="bg-destructive/5 rounded p-2 text-center">
              <p className="text-[9px] font-mono text-muted-foreground">RED</p>
              <p className="font-mono font-bold text-destructive">{reds}</p>
            </div>
            <div className={cn("rounded p-2 text-center", totalPL >= 0 ? 'bg-success/5' : 'bg-destructive/5')}>
              <p className="text-[9px] font-mono text-muted-foreground">P&L</p>
              <p className={cn("font-mono font-bold text-sm", totalPL >= 0 ? 'text-success' : 'text-destructive')}>
                R$ {totalPL.toFixed(0)}
              </p>
            </div>
            <div className={cn("rounded p-2 text-center", cumulativeROI >= 0 ? 'bg-success/5' : 'bg-destructive/5')}>
              <p className="text-[9px] font-mono text-muted-foreground">ROI</p>
              <p className={cn("font-mono font-bold text-sm", cumulativeROI >= 0 ? 'text-success' : 'text-destructive')}>
                {cumulativeROI >= 0 ? '+' : ''}{cumulativeROI.toFixed(1)}%
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
                  const { score, grade, config } = getScoreGrade(parseFloat(bet.odd));
                  const cumROI = cumulativeMap.get(bet.id);

                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "bg-card border rounded-lg p-3 space-y-2",
                        status === 'green' ? 'border-success/40' :
                        status === 'red' ? 'border-destructive/40' :
                        'border-border'
                      )}
                    >
                      {/* Row 1: Name + Status + Score */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-foreground truncate flex-1">
                          {bet.match_name || bet.match_id}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border",
                            config.border, config.bg, config.text
                          )}>
                            {config.emoji} {grade}
                          </span>
                          {status === 'green' ? (
                            <Badge className="bg-success/20 text-success border-success/30 text-[10px]">GREEN</Badge>
                          ) : status === 'red' ? (
                            <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">RED</Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">PENDENTE</Badge>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Data grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        <div className="bg-secondary/20 rounded px-2 py-1">
                          <p className="text-[8px] font-mono text-muted-foreground">DATA</p>
                          <p className="text-[10px] font-mono font-semibold text-foreground">{formatDate(bet.created_at)}</p>
                        </div>
                        <div className="bg-secondary/20 rounded px-2 py-1">
                          <p className="text-[8px] font-mono text-muted-foreground">MERCADO</p>
                          <p className="text-[10px] font-mono font-semibold text-foreground truncate">{bet.market}</p>
                        </div>
                        <div className="bg-secondary/20 rounded px-2 py-1">
                          <p className="text-[8px] font-mono text-muted-foreground">ODD</p>
                          <p className="text-[10px] font-mono font-semibold text-foreground">{parseFloat(bet.odd).toFixed(2)}</p>
                        </div>
                        <div className="bg-secondary/20 rounded px-2 py-1">
                          <p className="text-[8px] font-mono text-muted-foreground">STAKE</p>
                          <p className="text-[10px] font-mono font-semibold text-foreground">R$ {parseFloat(bet.stake).toFixed(2)}</p>
                        </div>
                        <div className={cn("rounded px-2 py-1", status !== 'pending' && parseFloat(bet.profit_loss) >= 0 ? 'bg-success/10' : status !== 'pending' ? 'bg-destructive/10' : 'bg-secondary/20')}>
                          <p className="text-[8px] font-mono text-muted-foreground">P&L</p>
                          <p className={cn("text-[10px] font-mono font-bold",
                            status === 'pending' ? 'text-muted-foreground' :
                            parseFloat(bet.profit_loss) >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {status === 'pending' ? '—' : `${parseFloat(bet.profit_loss) >= 0 ? '+' : ''}R$ ${parseFloat(bet.profit_loss).toFixed(2)}`}
                          </p>
                        </div>
                        <div className={cn("rounded px-2 py-1", cumROI != null && cumROI >= 0 ? 'bg-success/10' : cumROI != null ? 'bg-destructive/10' : 'bg-secondary/20')}>
                          <p className="text-[8px] font-mono text-muted-foreground">ROI ACUM.</p>
                          <p className={cn("text-[10px] font-mono font-bold",
                            cumROI == null ? 'text-muted-foreground' :
                            cumROI >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {cumROI != null ? `${cumROI >= 0 ? '+' : ''}${cumROI.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground">SCORE</span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", config.bg.replace('/10', '/60'))} style={{ width: `${score}%` }} />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-foreground">{score}</span>
                      </div>
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