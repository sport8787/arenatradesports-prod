import { useState, useCallback, useEffect, useMemo } from 'react';
import { getNextPunterAnalysisWindow, formatMinutesUntil } from '@/lib/punterSchedule';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Loader2, BarChart3, Calendar, DollarSign, 
  CheckCircle2, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Wallet, ArrowLeft, Brain, Clock, History, TrendingDown, XCircle, Activity, LayoutGrid, FlaskConical,
  Sparkles, User, Bot, Trophy, Award, Upload, Settings, Zap, CornerDownRight, MessageCircle, Bell, Copy, TrendingUp as TrendingUpIcon
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import GoldButton from '@/components/game/GoldButton';
import DualBankrollDashboard from '@/components/punter/DualBankrollDashboard';
import SherlockAnalyticButton from '@/components/punter/SherlockAnalyticButton';
import PunterHeroBanner from '@/components/punter/PunterHeroBanner';
import ExchangeEdgeBadge from '@/components/punter/ExchangeEdgeBadge';
import SteamBadge from '@/components/punter/SteamBadge';
import SportmonksPredictionBadge from '@/components/punter/SportmonksPredictionBadge';
import PunterViewModeToggle from '@/components/punter/PunterViewModeToggle';
import { usePunterViewMode } from '@/hooks/usePunterViewMode';
import CopySignalActions from '@/components/signals/CopySignalActions';
import SettledBetsDebugPanel from '@/components/punter/SettledBetsDebugPanel';

import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
import OnboardingTour from '@/components/punter/OnboardingTour';
import PushOptInBanner from '@/components/punter/PushOptInBanner';
import YesterdayRecapBanner from '@/components/punter/YesterdayRecapBanner';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
import { calculateAssetScore, getGradeConfig, type AssetScore } from '@/lib/assetScore';
import { getTierFromStake } from '@/lib/tierLabels';
import { calculateKellyStake } from '@/lib/kellyCalculator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playHorusTrigger, playHorusTTS, buildAnalysisResultPhrase } from '@/services/horusPunterVoiceService';
import { useCachedOdds, CachedGame } from '@/hooks/useCachedOdds';
import { useAdmin } from '@/hooks/useAdmin';
import { translateMarket } from '@/utils/marketTranslator';
import PlanoFavoritoPanel from '@/components/punter/PlanoFavoritoPanel';
import {
  validatePunterSinaisRows,
  buildPunterSinaisErrorMessage,
} from '@/lib/validatePunterSinais';

interface PunterSignal {
  analysis_id?: string; // ID do registro em punter_sinais (tabela unificada) para lookup confiável
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
    estimated_probability: number | null;
    implied_probability: number | null;
    stake_percentage: number;
    thesis: string;
    analysis: string;
    risk_factors: string;
    simulated_odds?: boolean;
    sherlock_alert?: boolean | null;
    sportmonks_probability?: number | null;
    sportmonks_divergence_pp?: number | null;
  };
}

export default function PunterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, refetchProfile } = useAuth();
  usePushNotifications(); // Auto-registra Web Push para receber entradas APROVADO + GREEN/RED
  const { isAdmin } = useAdmin();
  const { bankroll, loading: bankrollLoading, settleBets, updateInitialBalance } = useBankroll();
  const { bankroll: manualBankroll, loading: manualLoading, placeBet: placeManualBet, updateInitialBalance: updateManualBalance } = useManualBankroll();
  const { markComplete: markActivation } = useActivationChecklist();
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<PunterSignal[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [manualPendingBets, setManualPendingBets] = useState<any[]>([]);

  // Marca passos do checklist conforme o usuário usa o produto
  useEffect(() => {
    if (signals.some(s => /APROVADO/i.test(s.recommendation?.verdict || ''))) {
      markActivation('saw_first_signal');
    }
  }, [signals, markActivation]);
  useEffect(() => {
    if (bankroll && Number(bankroll.balance) > 0) {
      markActivation('configured_bankroll');
    }
  }, [bankroll, markActivation]);
  useEffect(() => {
    if (pendingBets.length > 0 || manualPendingBets.length > 0) {
      markActivation('placed_first_virtual_bet');
    }
  }, [pendingBets, manualPendingBets, markActivation]);

  // 🔥 Auto-claim do bônus diário de streak (BC). 1x por dia por usuário.
  useEffect(() => {
    if (!user?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `bc_streak_claimed_${user.id}_${today}`;
    if (localStorage.getItem(key)) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('claim_daily_streak_bonus', { p_user_id: user.id });
        if (error || !data) return;
        const bonus = Number(data) || 0;
        if (bonus > 0) {
          localStorage.setItem(key, '1');
          // toast leve avisando o ganho
          import('sonner').then(({ toast }) => {
            toast.success(`🪙 +${bonus} BC de streak diário! Volte amanhã para aumentar.`, {
              duration: 5000,
              action: {
                label: 'Loja BC',
                onClick: () => (window.location.href = '/loja-bc'),
              },
            });
          });
        }
      } catch {}
    })();
  }, [user?.id]);
  const [todayOnlyFilter, setTodayOnlyFilter] = useState(() => searchParams.get('today') === '1');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'A' | 'B' | 'C'>(() => {
    const c = searchParams.get('cat');
    return c === 'A' || c === 'B' || c === 'C' ? c : 'all';
  });
  const [futureSignals, setFutureSignals] = useState<any[]>([]); // awaiting_stake + stake_calculated
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
  const { isAdvanced } = usePunterViewMode();
  const [aiProvider, setAiProvider] = useState<'gemini' | 'anthropic'>('gemini');
  const [autoPlacedMatchIds, setAutoPlacedMatchIds] = useState<Set<string>>(new Set());
  const [placingHorusBets, setPlacingHorusBets] = useState(false);
  const [cornersLoading, setCornersLoading] = useState(false);
  const [cornersResults, setCornersResults] = useState<any[]>([]);
  const [haLoading, setHaLoading] = useState(false);
  const [smLoading, setSmLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const isNew = sessionStorage.getItem('showOpening') === 'true';
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    return isNew && !completed;
  });
  // Cached odds - loaded from daily cron (no API call on user access)
  const { games: cachedGames, loading: cachedLoading, lastFetched, isEmpty: cacheEmpty } = useCachedOdds();
  const ANALYSIS_NT_COST = 50; // NT cost per analysis run
  const LOCAL_CORNERS_SIGNALS_KEY = 'punter_corners_signals_v1';

  const loadLocalCornersSignals = (): PunterSignal[] => {
    try {
      const raw = localStorage.getItem(LOCAL_CORNERS_SIGNALS_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const nowTs = Date.now();
      return parsed.filter((item: any) => {
        if (!item?.match || !item?.recommendation) return false;
        const kickoffTs = item.match.commence_time ? Date.parse(item.match.commence_time) : NaN;
        return Number.isNaN(kickoffTs) || kickoffTs > nowTs;
      });
    } catch {
      return [];
    }
  };

  const saveLocalCornersSignals = (items: PunterSignal[]) => {
    try {
      localStorage.setItem(LOCAL_CORNERS_SIGNALS_KEY, JSON.stringify(items.slice(0, 200)));
    } catch {
      // ignore localStorage failures
    }
  };

  // Sets de jogo+mercado com entrada já realizada — SEPARADOS por origem.
  // `manualBetMatchKeys`: apenas entradas MANUAIS do usuário (bloqueiam o botão APOSTAR e mostram "Entrada já registrada").
  // `horusBetMatchKeys`: entradas auto-colocadas pelo Hórus (apenas informativo via `horusEntered`).
  // Chaveado por `home_away|market` normalizado.
  const buildKeySet = (bets: any[]) => {
    const keys = new Set<string>();
    const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '_').replace(/\+00:00/g, 'z');
    const normMarket = (m: string) => (m || '').toLowerCase().replace(/\s+/g, '_');
    const addKey = (matchId?: string, matchName?: string, market?: string) => {
      const mk = normMarket(market || '');
      if (!mk) return;
      if (matchId) {
        keys.add(`${norm(matchId)}|${mk}`);
        const withoutTime = String(matchId).split('_').slice(0, 2).join('_');
        if (withoutTime) keys.add(`${norm(withoutTime)}|${mk}`);
      }
      if (matchName) {
        const m = matchName.split(/\s+vs\s+/i);
        if (m.length === 2) keys.add(`${norm(`${m[0]}_${m[1]}`)}|${mk}`);
      }
    };
    for (const bet of bets) addKey(bet.match_id, bet.match_name, bet.market);
    return keys;
  };

  const manualBetMatchKeys = useMemo(() => buildKeySet(manualPendingBets), [manualPendingBets]);
  const horusBetMatchKeys = useMemo(() => buildKeySet(pendingBets), [pendingBets]);

  // Compatibilidade: usado em outros pontos como conjunto agregado (somente leitura)
  const pendingMatchKeys = useMemo(() => {
    const all = new Set<string>(manualBetMatchKeys);
    horusBetMatchKeys.forEach((k) => all.add(k));
    return all;
  }, [manualBetMatchKeys, horusBetMatchKeys]);

  // Entradas NOVOS = aprovados após a última visita (persistido em localStorage)
  const SEEN_KEY = 'punter_seen_signal_ids_v1';
  const [seenSignalIds, setSeenSignalIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set<string>();
  });

  // Helper para extrair um id estável por entrada (analysis_id, ou home_away_market)
  const signalKey = (s: PunterSignal): string => {
    const aid = (s as any).analysis_id;
    if (aid) return String(aid);
    return `${s.match.home_team}_${s.match.away_team}_${s.recommendation.market}`.toLowerCase().replace(/\s+/g, '_');
  };

  // Marca novos entradas e persiste após 8s para que o badge NOVO permaneça visível durante a visita
  useEffect(() => {
    if (!signals || signals.length === 0) return;
    const t = setTimeout(() => {
      setSeenSignalIds((prev) => {
        const next = new Set(prev);
        for (const s of signals) next.add(signalKey(s));
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(next).slice(-500))); } catch {}
        return next;
      });
    }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals]);

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

      // Load future signals (awaiting_stake + stake_calculated) — punter_sinais é tabela unificada
      const { data: futureData } = await supabase
        .from('punter_sinais')
        .select('*')
        .in('status', ['awaiting_stake', 'stake_calculated'])
        .eq('dismissed', false)
        .order('commence_time', { ascending: true });
      if (futureData) setFutureSignals(futureData);

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
              const matchKeyShort = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
              const marketKey = (signal.recommendation.market || '').toLowerCase().replace(/\s+/g, '_');
              const combinedKey = `${matchKeyShort}|${marketKey}`;
              if (pendingIds.has(combinedKey)) continue;
              const placed = await autoPlaceHorusBet(signal);
              if (placed) {
                autoPlaced++;
                newAutoIds.add(combinedKey);
                pendingIds.add(combinedKey);
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

    toast.success('Entradas liquidadas! Histórico e pendências atualizados.');

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

  // Auto-abre painéis quando navegado com ?panel=...
  useEffect(() => {
    const panel = searchParams.get('panel');
    if (!panel) return;
    if (panel === 'horus-positions') openHistory();
    else if (panel === 'my-positions') openManualHistory();
    else if (panel === 'settle') handleSettleBets();
    else if (panel === 'backtest') setShowBacktest(true);
    else if (panel === 'rankings') setShowRankings(true);
    else if (panel === 'certificate') setShowCertificate(true);
    else if (panel === 'analyze') {
      // dispara análise automaticamente ao chegar via "Buscar Entradas Agora"
      setTimeout(() => { analyzeGames(); }, 400);
    }
    // limpa o param para não reabrir
    searchParams.delete('panel');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Foco em sinal específico vindo de /minhas-apostas (?focus=home_away)
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || signals.length === 0) return;
    const targetId = `signal-${focus.toLowerCase()}`;
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background', 'rounded-xl');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        }, 3500);
        const next = new URLSearchParams(searchParams);
        next.delete('focus');
        setSearchParams(next, { replace: true });
      } else if (attempt < 10) {
        setTimeout(() => tryScroll(attempt + 1), 300);
      }
    };
    tryScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, signals]);

  // Sincroniza filtros (?today=1 e ?cat=A|B|C) na URL para permitir compartilhar/recarregar mantendo estado
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (todayOnlyFilter) next.set('today', '1');
    else next.delete('today');
    if (categoryFilter !== 'all') next.set('cat', categoryFilter);
    else next.delete('cat');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnlyFilter, categoryFilter]);
  const confirmFutureSignal = async (signal: any) => {
    if (!user || !bankroll) return;

    // punter_sinais é unificada — dados do match estão no próprio registro
    const stakePercent = signal.stake_percentage || signal.stake_percentage_original || 3;
    const stakeAmount = Math.round(bankroll.balance * (stakePercent / 100) * 100) / 100;

    if (stakeAmount <= 0 || stakeAmount > bankroll.balance) {
      toast.error('Saldo insuficiente para confirmar esta entrada');
      return;
    }

    const matchName = `${signal.home_team} vs ${signal.away_team}`;
    const matchId = (signal.match_id || '').replace(/\+00:00/g, 'Z');

    // Place the bet
    const { error: betError } = await supabase
      .from('virtual_bets_punter')
      .insert({
        user_id: user.id,
        match_id: matchId,
        match_name: matchName,
        market: signal.market,
        odd: signal.odd,
        stake: stakeAmount,
        status: 'pending',
        thesis: signal.thesis || null,
        commence_time: signal.commence_time || null,
        signal_id: signal.id,
      } as any);

    if (betError) {
      if (betError.code === '23505') {
        toast.info('Entrada já existe para este jogo');
        return;
      }
      toast.error('Erro ao confirmar entrada');
      return;
    }

    // Deduct bankroll
    await supabase.rpc('deduct_bankroll' as any, {
      p_user_id: user.id,
      p_amount: stakeAmount,
    });

    // Update signal status
    await supabase
      .from('punter_sinais')
      .update({ status: 'confirmed', stake_confirmed: true, stake_amount: stakeAmount } as any)
      .eq('id', signal.id);

    // Refresh states
    setFutureSignals(prev => prev.filter(s => s.id !== signal.id));
    const { data: refreshed } = await supabase
      .from('virtual_bets_punter')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (refreshed) setPendingBets(refreshed);

    toast.success(`✅ Confirmado: R$ ${stakeAmount.toFixed(2)} em ${matchName}`);
  };

  // Dismiss a future signal
  const dismissFutureSignal = async (signal: any) => {
    await supabase
      .from('punter_sinais')
      .update({ dismissed: true, dismissed_at: new Date().toISOString(), status: 'dismissed' } as any)
      .eq('id', signal.id);

    setFutureSignals(prev => prev.filter(s => s.id !== signal.id));
    toast.info('Entrada dispensado');
  };


  const fetchSavedSignals = async (): Promise<PunterSignal[]> => {
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();
    // Janela: jogos futuros + jogos que começaram há menos de 3h (ainda em andamento, não liquidados)
    const inPlayCutoffIso = new Date(nowTs - 3 * 60 * 60 * 1000).toISOString();

    const { data: savedAnalyses, error: fetchErr } = await supabase
      .from('punter_sinais')
      .select('*')
      .eq('verdict', 'APROVADO')
      .gt('commence_time', inPlayCutoffIso)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchErr) {
      console.error('[Punter] Erro ao carregar punter_sinais:', fetchErr);
      setSchemaError(
        `Falha ao consultar a tabela "punter_sinais": ${fetchErr.message}. ` +
        `Verifique se a tabela existe e está acessível.`
      );
      return [];
    }

    // Valida shape antes de renderizar — schema desatualizado quebra a UI silenciosamente
    const validation = validatePunterSinaisRows(savedAnalyses);
    if (!validation.valid) {
      const msg = buildPunterSinaisErrorMessage(validation);
      console.error('[Punter] Schema inválido em punter_sinais:', validation);
      setSchemaError(msg);
      return [];
    }
    if (validation.missingExpected.length > 0) {
      console.warn(
        '[Punter] Campos opcionais ausentes em punter_sinais:',
        validation.missingExpected
      );
    }
    // Limpa erro de schema anterior se passou
    setSchemaError(null);

    const dbDedupMap = new Map<string, any>();
    for (const a of savedAnalyses || []) {
      const key = `${a.home_team}_${a.away_team}_${a.market}`.toLowerCase().replace(/\s+/g, '_');
      if (!dbDedupMap.has(key)) {
        dbDedupMap.set(key, a);
      }
    }

    const dbSignals: PunterSignal[] = Array.from(dbDedupMap.values()).map((a: any) => ({
      analysis_id: a.id,
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
        estimated_probability: a.estimated_probability,
        implied_probability: a.implied_probability,
        stake_percentage: a.stake_percentage,
        thesis: a.thesis,
        analysis: a.analysis,
        risk_factors: a.risk_factors,
        sherlock_alert: a.sherlock_alert ?? null,
        sportmonks_probability: a.sportmonks_probability ?? null,
        sportmonks_divergence_pp: a.sportmonks_divergence_pp ?? null,
      },
    }));

    const localCorners = loadLocalCornersSignals();

    const mergedMap = new Map<string, PunterSignal>();
    const inPlayCutoffTs = nowTs - 3 * 60 * 60 * 1000;
    for (const signal of [...localCorners, ...dbSignals]) {
      const key = `${signal.match.home_team}_${signal.match.away_team}_${signal.recommendation.market}`
        .toLowerCase()
        .replace(/\s+/g, '_');
      const kickoffTs = signal.match.commence_time ? Date.parse(signal.match.commence_time) : NaN;
      // Mantém se: kickoff desconhecido, futuro, OU começou há menos de 3h (jogo em andamento)
      if (Number.isNaN(kickoffTs) || kickoffTs > inPlayCutoffTs) {
        mergedMap.set(key, signal);
      }
    }

    const merged = Array.from(mergedMap.values()).sort((a, b) => {
      const ta = Date.parse(a.match.commence_time || '') || Number.MAX_SAFE_INTEGER;
      const tb = Date.parse(b.match.commence_time || '') || Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

    saveLocalCornersSignals(
      merged.filter((s) => (s.recommendation.market || '').toLowerCase().includes('escanteios'))
    );

    return merged;
  };

  // Auto-place Hórus bet for a single signal (no toast per bet)
  const autoPlaceHorusBet = async (signal: PunterSignal, skipSignalCheck = false) => {
    if (!bankroll || !user) {
      console.log(`[Hórus] ❌ Bankroll ou user indisponível`);
      return false;
    }

    // Build match_id for bet storage — ALWAYS normalize +00:00 → Z to prevent duplicates
    const rawMatchId = `${signal.match.home_team}_${signal.match.away_team}_${signal.match.commence_time}`.replace(/\s+/g, '_');
    const matchId = rawMatchId.replace(/\+00:00/g, 'Z');
    
    // For fresh analysis signals, skip the punter_sinais lookup (signal already approved by AI)
    let canonicalMatchId = matchId;
    
    if (!skipSignalCheck) {
      // punter_sinais (unificada) — busca por id (que é o analysis_id retornado pelo fetchSavedSignals)
      let confirmedSignal: any = null;
      if (signal.analysis_id) {
        const { data } = await supabase
          .from('punter_sinais')
          .select('id, stake_confirmed, match_id')
          .or(`id.eq.${signal.analysis_id},legacy_analysis_id.eq.${signal.analysis_id},legacy_signal_id.eq.${signal.analysis_id}`)
          .eq('stake_confirmed', true)
          .maybeSingle();
        confirmedSignal = data;
      }
      
      // Fallback: try by home/away team match
      if (!confirmedSignal) {
        const { data } = await supabase
          .from('punter_sinais')
          .select('id, stake_confirmed, match_id')
          .eq('stake_confirmed', true)
          .eq('status', 'pending')
          .ilike('match_id', `${signal.match.home_team}_${signal.match.away_team}%`.replace(/\s+/g, '_'));
        confirmedSignal = data?.[0] || null;
      }

      if (!confirmedSignal) {
        console.log(`[Hórus] ⚠️ Nenhum entrada confirmado para ${signal.match.home_team} vs ${signal.match.away_team} — tentando entrada direta`);
        // Don't block — proceed with direct placement since signal came from analysis
      } else {
        canonicalMatchId = confirmedSignal.match_id || matchId;
      }
    } else {
      console.log(`[Hórus] ✅ Entrada direta (fresh analysis): ${signal.match.home_team} vs ${signal.match.away_team}`);
    }

    // Kelly Criterion for smart stake sizing — use fair_odd to derive real probability
    const estimatedProb = signal.recommendation.estimated_probability
      ?? (signal.recommendation.fair_odd > 0 ? (1 / signal.recommendation.fair_odd) * 100 : (signal.recommendation.confidence || 55));
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

    // Check if Hórus already bet on this match (any status — prevents re-betting on re-analysis)
    // Check both canonical and constructed match_id to be safe
    const { data: existingBets } = await supabase
      .from('virtual_bets_punter')
      .select('id')
      .eq('user_id', user.id)
      .or(`match_id.eq.${canonicalMatchId},match_id.eq.${matchId}`)
      .in('status', ['pending', 'green', 'red']);

    if (existingBets && existingBets.length > 0) return false; // Already bet

    // Calculate asset score for storage
    const assetScoreResult = calculateAssetScore({
      value_percentage: signal.recommendation.value_percentage,
      confidence: signal.recommendation.confidence,
      odd: signal.recommendation.odd,
      bookmaker: signal.recommendation.bookmaker,
      estimated_probability: signal.recommendation.estimated_probability ?? undefined,
    });

    console.log(`[Hórus] 🎯 Inserindo entrada: ${matchName} | Stake: ${stake} | Odd: ${signal.recommendation.odd} | MatchID: ${canonicalMatchId}`);
    // Normalize match_id to prevent Z vs +00:00 duplicates
    const normalizedMatchId = canonicalMatchId.replace(/\+00:00/g, 'Z');
    const { error: betError } = await supabase
      .from('virtual_bets_punter')
      .insert({
        user_id: user.id,
        match_id: normalizedMatchId,
        match_name: matchName,
        market: signal.recommendation.market,
        odd: signal.recommendation.odd,
        stake: stake,
        status: 'pending',
        thesis: signal.recommendation.thesis || null,
        commence_time: signal.match.commence_time || null,
        asset_score: assetScoreResult.final_score,
      } as any);

    if (betError) {
      // If duplicate constraint error, just skip silently
      if (betError.code === '23505') {
        console.log(`[Hórus] ⏭️ Entrada duplicada detectada — ignorando: ${matchName}`);
        return false;
      }
      console.error(`[Hórus] Bet insert error for ${matchName}:`, betError.message);
      return false;
    }

    // Atomic bankroll deduction to avoid race conditions in sequential auto-bets
    const { error: bankrollErr } = await supabase.rpc('deduct_bankroll' as any, {
      p_user_id: user.id,
      p_amount: stake,
    });

    if (bankrollErr) {
      console.warn('Atomic deduction failed, using fallback:', bankrollErr.message);
      await supabase.from('user_bankroll').update({
        balance: +(bankroll.balance - stake).toFixed(2),
        total_staked: +(bankroll.total_staked + stake).toFixed(2),
        total_bets: bankroll.total_bets + 1,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }

    // Update local bankroll
    bankroll.balance -= stake;
    bankroll.total_staked += stake;
    bankroll.total_bets += 1;

    return true;
  };

  // Manual button: place Hórus bets for all approved signals
  const manualPlaceAllHorusBets = async () => {
    if (!bankroll || !user) {
      toast.error('Bankroll ou login indisponível');
      return;
    }

    // Use signals if available, otherwise reload from DB
    let signalsToPlace = signals.length > 0 ? signals : await fetchSavedSignals();
    if (signalsToPlace.length === 0) {
      toast.error('Sem entradas aprovados para executar');
      return;
    }
    setPlacingHorusBets(true);
    try {
      // Fetch existing bets to avoid duplicates
      const { data: existingBets } = await supabase
        .from('virtual_bets_punter')
        .select('match_id')
        .eq('user_id', user.id)
        .in('status', ['pending', 'green', 'red']);
      
      const existingIds = new Set(
        (existingBets || []).map((b: any) => (b.match_id || '').toLowerCase())
      );

      let placed = 0;
      for (const signal of signalsToPlace) {
        const matchId = `${signal.match.home_team}_${signal.match.away_team}_${signal.match.commence_time}`.replace(/\s+/g, '_').toLowerCase();
        if (existingIds.has(matchId)) continue;
        
        const success = await autoPlaceHorusBet(signal, true);
        if (success) {
          placed++;
          existingIds.add(matchId);
        }
      }

      if (placed > 0) {
        toast.success(`🤖 Hórus executou ${placed} entradas com Kelly`);
        playHorusTrigger('provocacao');
        // Refresh pending bets
        const { data: updated } = await supabase
          .from('virtual_bets_punter')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (updated) setPendingBets(updated);
      } else {
        toast.info('Todas as entradas já foram realizadas');
      }
    } catch (err: any) {
      console.error('[Hórus] Manual bet error:', err);
      toast.error('Erro ao executar entradas');
    } finally {
      setPlacingHorusBets(false);
    }
  };

  const analyzeGames = async () => {
    if (!user) {
      setError('Você precisa estar logado para analisar jogos');
      return;
    }
    if (!isAdmin) {
      toast.error('🔒 Análise de Mercado é exclusiva para administradores');
      return;
    }

    // Análise de mercado é exclusiva para admin — sem cobrança de NT.
    refetchProfile();


    setLoading(true);
    setError(null);

    // 🔊 Hórus announces analysis start (local audio, no API call)
    playHorusTrigger('analisando_jogos');

    try {
      const savedSignals = await fetchSavedSignals();
      const hoursAhead = timeWindow === '15min' ? 0.25 : 48;
      const functionName = aiProvider === 'anthropic' ? 'mycroft-punter-anthropic' : 'mycroft-punter-analysis';
      
      // Use fetch with extended timeout (5 min) — supabase.functions.invoke times out too early
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5 min
      let data: any = null;
      let fnError: any = null;
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              hours_ahead: hoursAhead,
              bookmakers: ['bet365', 'pinnacle', 'betfair'],
              min_value: 5,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        if (!resp.ok) {
          // Gateway timeout or server error — signals may still be saved in DB
          if (resp.status >= 502 && resp.status <= 504) {
            console.warn(`[Punter] Gateway timeout (${resp.status}) — reloading saved signals from DB`);
            fnError = new Error('gateway_timeout');
          } else {
            const statusText = resp.status >= 500 ? 'Servidor sobrecarregado — tente novamente ou use janela 15min' : `Edge Function error: ${resp.status}`;
            fnError = new Error(statusText);
          }
          try { data = await resp.json(); } catch { data = null; }
        } else {
          data = await resp.json();
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          fnError = new Error('gateway_timeout');
        } else if (fetchErr.message?.includes('Failed to fetch') || fetchErr.message?.includes('NetworkError')) {
          fnError = new Error('gateway_timeout');
        } else {
          fnError = fetchErr;
        }
      }

      const newSignals: PunterSignal[] = (data?.signals || []);
      const newAnalyzed = data?.total_analyzed || 0;
      const newApproved = data?.total_approved || 0;

      // Dedup key: home_away_market (ignoring commence_time variations)
      const signalKey = (s: PunterSignal) =>
        `${s.match.home_team}_${s.match.away_team}_${s.recommendation.market}`.toLowerCase().replace(/\s+/g, '_');

      const mergedMap = new Map<string, PunterSignal>();
      // Saved signals first (older), then new signals overwrite (fresher data)
      // But preserve analysis_id from saved signals if new ones don't have it
      for (const s of savedSignals) mergedMap.set(signalKey(s), s);
      for (const s of newSignals) {
        const key = signalKey(s);
        const existing = mergedMap.get(key);
        // Preserve analysis_id from saved signal if new signal doesn't have one
        if (existing?.analysis_id && !s.analysis_id) {
          s.analysis_id = existing.analysis_id;
        }
        mergedMap.set(key, s);
      }
      const mergedSignals = Array.from(mergedMap.values());

      setSignals(mergedSignals);
      setTotalAnalyzed(newAnalyzed);
      setTotalApproved(mergedSignals.length);

      // Auto-place Hórus bets — robust anti-duplication via fresh DB check
      if (bankroll && mergedSignals.length > 0) {
        // Fetch ALL bets (pending + settled) to prevent duplicates across re-analyses
        const { data: freshPending } = await supabase
          .from('virtual_bets_punter')
          .select('match_id, status')
          .eq('user_id', user.id)
          .in('status', ['pending', 'green', 'red']);
        
        const existingMatchIds = new Set(
          (freshPending || []).map((b: any) => (b.match_id || '').toLowerCase())
        );

        let autoPlaced = 0;
        const newAutoIds = new Set<string>();
        for (const signal of mergedSignals) {
          const matchId = `${signal.match.home_team}_${signal.match.away_team}_${signal.match.commence_time}`.replace(/\s+/g, '_').toLowerCase();
          // Skip if already has a pending bet (from any source)
          if (existingMatchIds.has(matchId)) continue;
          
          const placed = await autoPlaceHorusBet(signal, true); // skipSignalCheck for fresh analysis
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
        // On gateway timeout, re-fetch saved signals from DB (function may have saved results before dying)
        if (fnError.message === 'gateway_timeout') {
          const freshSaved = await fetchSavedSignals();
          if (freshSaved.length > 0) {
            // Merge fresh DB signals with any new signals we got
            const freshMap = new Map<string, PunterSignal>();
            for (const s of mergedSignals) freshMap.set(signalKey(s), s);
            for (const s of freshSaved) freshMap.set(signalKey(s), s);
            const allSignals = Array.from(freshMap.values());
            setSignals(allSignals);
            setTotalApproved(allSignals.length);
            toast.info(`⏱️ Análise parcial — ${allSignals.length} entradas carregados do banco`);
          } else if (savedSignals.length > 0) {
            toast.info(`${savedSignals.length} entradas salvos carregados (análise excedeu tempo)`);
          } else {
            toast.warning('Análise excedeu o tempo. Tente janela "15min" para análise mais rápida.');
          }
        } else if (savedSignals.length > 0) {
          toast.info(`${savedSignals.length} entradas salvos carregados (nova análise falhou)`);
        } else {
          throw fnError;
        }
      } else {
        const savedOnly = mergedSignals.length - newApproved;
        const timedOut = data?.timed_out;
        const remaining = data?.remaining_games || 0;
        const execTime = data?.execution_time_s || 0;
        let msg = savedOnly > 0
          ? `${newApproved} novos + ${savedOnly} salvos = ${mergedSignals.length} entradas (Gemini)`
          : `${newApproved} entradas aprovados de ${newAnalyzed} jogos (Gemini)`;
        if (timedOut) msg += ` ⏱️ Parcial (${remaining} jogos pendentes)`;
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
      setError(err.message || 'Erro ao conectar com Mycroft Punter (Gemini)');
      // 🔊 Play alert audio on error
      playHorusTrigger('alerta');
    } finally {
      setLoading(false);
    }
  };

  // ═══ ANALISAR ESCANTEIOS ═══
  const analyzeCornersMarket = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    // NT cost
    try {
      const { data: spentOk } = await supabase.rpc('spend_nt_balance', {
        p_user_id: user.id,
        p_amount: ANALYSIS_NT_COST,
      });
      if (spentOk === false) {
        toast.error(`⚡ Saldo insuficiente! Precisa de ${ANALYSIS_NT_COST} NT.`);
        return;
      }
      toast.info(`⚡ -${ANALYSIS_NT_COST} NT debitados para análise de escanteios`);
    } catch {
      console.warn('NT check failed, proceeding');
    }
    refetchProfile();

    setCornersLoading(true);
    setCornersResults([]);

    try {
      // Get cached games to find fixtures
      const games = cachedGames.length > 0 ? cachedGames : [];
      if (games.length === 0) {
        toast.warning('Nenhum jogo em cache. Execute "Analisar Mercado" primeiro para popular o cache.');
        setCornersLoading(false);
        return;
      }

      const results: any[] = [];
      // Analyze max 5 games (each calls API-Football ~12 times)
      const gamesToAnalyze = games.slice(0, 5);
      toast.info(`🔍 Analisando escanteios de ${gamesToAnalyze.length} jogos... (pode levar até 2 min)`);

      for (const game of gamesToAnalyze) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000); // 60s per game

          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mycroft-corners-punter`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                home_team_name: game.home_team,
                away_team_name: game.away_team,
                liga: game.sport_key,
                season: 2025,
                commence_time: game.commence_time,
                data_source: 'sportmonks',
              }),
            }
          );
          clearTimeout(timeout);

          if (resp.ok) {
            const data = await resp.json();
            console.log(`[Corners] ${game.home_team} vs ${game.away_team}: aprovados=${data.aprovados_count}`);
            if (data.success && data.aprovados_count > 0 && data.veredicto) {
              results.push({ ...data, _game: game });
            }
          }
        } catch (err) {
          console.warn(`Corners analysis failed for ${game.home_team} vs ${game.away_team}:`, err);
        }
      }

      setCornersResults(results);

      if (results.length > 0) {
        // Persist corners signals to DB (same pattern as main analysis)
        const cornersSignals: PunterSignal[] = [];
        
        for (const r of results.filter(r => r.veredicto && r.veredicto.verdict?.startsWith('APROVADO'))) {
          const commenceTime = r._game?.commence_time || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
          const matchDate = commenceTime.slice(0, 10);
          const mid = `${r.mandante}_${r.visitante}_${commenceTime}`.replace(/\s+/g, '_');
          const market = `Escanteios: ${r.veredicto.market}`;
          const verdict = r.veredicto.verdict === 'APROVADO_TIER_1' ? 'APROVADO_ELITE' : r.veredicto.verdict === 'APROVADO_TIER_2' ? 'APROVADO_FORTE' : 'APROVADO_TEM_VALOR';
          // Note: verdict stored in DB stays internal; user-facing label derived from stake %
          const odd = r.veredicto.odd || 1.80;
          const confidence = r.veredicto.confidence || 0;
          const edge = r.veredicto.edge_percentage || 0;
          const stakePerc = r.veredicto.stake_percentage || 2;
          const thesis = `${r.veredicto.plano_ativado}: ${r.veredicto.thesis}`;

          // Dedup: remove old corners signal for same match+market (tabela unificada)
          await supabase.from('punter_sinais').delete().eq('match_id', mid).eq('market', market);

          // Insert into punter_sinais (tabela unificada — sem split entre analyses/signals)
          const { error: insertErr } = await supabase.from('punter_sinais').insert({
            match_id: mid,
            home_team: r.mandante,
            away_team: r.visitante,
            league: r.liga || 'Escanteios',
            commence_time: commenceTime,
            match_date: matchDate,
            market,
            bookmaker: r.veredicto.bookmaker || 'Mycroft Corners',
            odd,
            fair_odd: confidence > 0 ? Math.round((1 / (confidence / 100)) * 100) / 100 : 1.70,
            value_percentage: edge,
            confidence,
            thesis,
            analysis: r.veredicto.analysis || '',
            risk_factors: r.veredicto.risk_factors || '',
            verdict: 'APROVADO',
            stake_percentage: stakePerc,
            analyzed_by: 'mycroft-corners-punter',
            status: 'stake_calculated',
            stake_confirmed: false,
          } as any);

          if (insertErr) {
            console.error('[Corners] Insert punter_sinais error:', insertErr);
          }

          cornersSignals.push({
            match: {
              home_team: r.mandante,
              away_team: r.visitante,
              commence_time: commenceTime,
              league: r.liga,
            },
            recommendation: {
              verdict,
              market,
              bookmaker: r.veredicto.bookmaker || 'Mycroft Corners',
              odd,
              fair_odd: confidence > 0 ? Math.round((1 / (confidence / 100)) * 100) / 100 : 1.70,
              value_percentage: edge,
              confidence,
              estimated_probability: null,
              implied_probability: null,
              stake_percentage: stakePerc,
              thesis,
              analysis: r.veredicto.analysis || '',
              risk_factors: r.veredicto.risk_factors || '',
            },
          });
        }

        setSignals(prev => {
          const merged = [...prev];
          for (const cs of cornersSignals) {
            const key = `${cs.match.home_team}_${cs.match.away_team}_${cs.recommendation.market}`.toLowerCase();
            if (!merged.some(s => `${s.match.home_team}_${s.match.away_team}_${s.recommendation.market}`.toLowerCase() === key)) {
              merged.push(cs);
            }
          }

          const onlyCorners = merged.filter((s) =>
            (s.recommendation.market || '').toLowerCase().includes('escanteios')
          );
          saveLocalCornersSignals(onlyCorners);

          return merged;
        });

        toast.success(`⚽ ${results.length} jogos com oportunidade em escanteios! (${results.reduce((sum, r) => sum + r.aprovados_count, 0)} métodos aprovados)`);
        playHorusTrigger('provocacao');
      } else {
        toast.info('Nenhuma oportunidade encontrada no mercado de escanteios.');
      }
    } catch (err: any) {
      console.error('Corners analysis error:', err);
      toast.error('Erro na análise de escanteios');
    } finally {
      setCornersLoading(false);
    }
  };

  const placeBetManual = useCallback(async (signal: PunterSignal, customStake: number) => {
    if (!manualBankroll || !user) {
      toast.error('Bankroll Manual não carregada');
      return;
    }
    if (customStake <= 0) {
      toast.error('Valor da entrada deve ser maior que zero');
      return;
    }
    if (customStake > manualBankroll.balance) {
      toast.error('Saldo insuficiente na Bankroll Manual');
      return;
    }
    const matchName = `${signal.match.home_team} vs ${signal.match.away_team}`;
    const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_');

    const assetScoreResult = calculateAssetScore({
      value_percentage: signal.recommendation.value_percentage,
      confidence: signal.recommendation.confidence,
      odd: signal.recommendation.odd,
      bookmaker: signal.recommendation.bookmaker,
      estimated_probability: signal.recommendation.estimated_probability ?? undefined,
    });

    const result = await placeManualBet({
      match_id: matchId,
      match_name: matchName,
      market: signal.recommendation.market,
      odd: signal.recommendation.odd,
      stake: customStake,
      thesis: signal.recommendation.thesis,
      commence_time: signal.match.commence_time || undefined,
      asset_score: assetScoreResult.final_score,
    });

    if (!result.success) {
      toast.error(result.error || 'Erro');
      return;
    }

    // Refresh manual pending bets list
    setManualPendingBets(prev => [...prev, {
      match_id: matchId,
      match_name: matchName,
      market: signal.recommendation.market,
      odd: signal.recommendation.odd,
      stake: customStake,
      status: 'pending',
      created_at: new Date().toISOString(),
    }]);

    toast.success(`Manual: R$ ${customStake.toFixed(2)} em ${matchName}`);
  }, [manualBankroll, user, placeManualBet]);

  if (showBacktest) return <BacktestPanel onClose={() => setShowBacktest(false)} />;
  if (showRankings) return <PunterRankings onClose={() => setShowRankings(false)} />;
  if (showCertificate && bankroll) return <PerformanceCertificate bankroll={bankroll} onClose={() => setShowCertificate(false)} />;

  return (
    <div className="min-h-screen bg-background">
      {showOnboarding && (
        <OnboardingTour onComplete={() => {
          setShowOnboarding(false);
          sessionStorage.removeItem('showOpening');
        }} />
      )}
      {/* Header — Bloomberg-style top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground transition-colors">
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
            <PunterViewModeToggle />
            <HeaderBtn icon={<History className="w-3.5 h-3.5" />} label="Minhas Apostas" onClick={() => navigate('/minhas-apostas')} />
            <button
              onClick={() => navigate('/punter/menu')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-mono font-semibold"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Funções</span>
            </button>
            {isAdmin && (
              <>
                <HeaderBtn icon={<Bot className="w-3.5 h-3.5" />} label="Posições Hórus" onClick={openHistory} />
                <HeaderBtn icon={<User className="w-3.5 h-3.5" />} label="Minhas Posições" onClick={openManualHistory} />
                <HeaderBtn icon={settlingBets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} label="Liquidar" onClick={handleSettleBets} disabled={settlingBets} />
                {isAdvanced && (
                  <HeaderBtn icon={<Activity className="w-3.5 h-3.5" />} label="Backtest" onClick={() => setShowBacktest(true)} />
                )}
                <HeaderBtn icon={<Trophy className="w-3.5 h-3.5" />} label="Ranking" onClick={() => setShowRankings(true)} />
                <HeaderBtn icon={<Award className="w-3.5 h-3.5" />} label="Cert." onClick={() => setShowCertificate(true)} />
                <HeaderBtn icon={<Brain className="w-3.5 h-3.5" />} label="KB" onClick={() => setIsChatOpen(true)} />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-5xl">
        {/* Retenção: resumo de ontem + opt-in de push (somem após interação) */}
        <YesterdayRecapBanner />
        <PushOptInBanner />

        {/* Hero Banner: prova social + entrada destaque + countdown + telegram CTA */}
        {(() => {
          const sortedByConfidence = [...signals].sort(
            (a, b) => (b.recommendation?.confidence ?? 0) - (a.recommendation?.confidence ?? 0)
          );
          const topSignal = sortedByConfidence[0];
          const featured = topSignal
            ? {
                match_label: `${topSignal.match.home_team} vs ${topSignal.match.away_team}`,
                league: topSignal.match.league || '—',
                market: topSignal.recommendation.market,
                odd: Number(topSignal.recommendation.odd) || 0,
                confidence: Math.round(topSignal.recommendation.confidence || 0),
              }
            : null;
          const nowTs = Date.now();
          const upcoming = [...signals]
            .filter((s) => s.match.commence_time && Date.parse(s.match.commence_time) > nowTs)
            .sort((a, b) => Date.parse(a.match.commence_time) - Date.parse(b.match.commence_time))[0];
          const next = upcoming
            ? {
                label: `${upcoming.match.home_team} vs ${upcoming.match.away_team}`,
                league: upcoming.match.league || '',
                kickoff: upcoming.match.commence_time,
              }
            : null;
          return (
            <>
              <PunterHeroBanner
                userId={user?.id}
                featuredSignal={featured}
                nextMatch={next}
                onCtaClick={() => {
                  const el = document.getElementById('signals-section');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
              {isAdvanced && <SettledBetsDebugPanel userId={user?.id} />}
            </>
          );
        })()}

        {/* Navigation Grid movido para /punter/menu */}


        {/* Scanner Panel — exclusivo Admin */}
        {isAdmin && (
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
              <div className="space-y-1" title="Exclusivo Admin · Sem custo NT · Powered by Gemini">
                <GoldButton
                  onClick={analyzeGames}
                  disabled={loading}
                  className="w-full font-mono text-xs tracking-wider"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SCANNING...</>
                  ) : (
                    <><BarChart3 className="mr-2 h-4 w-4" /> ANALISAR MERCADO</>
                  )}
                </GoldButton>
                <p className="text-[10px] font-mono text-muted-foreground text-center">
                  🔒 Exclusivo Admin · Sem custo NT · Gemini
                </p>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-1" title="Exclusivo Admin · Análise via Sportmonks Pro + Groq Llama 3.3 70B">
                <Button
                  onClick={async () => {
                    if (smLoading) return;
                    setSmLoading(true);
                    toast.info('🔍 Analisando via Sportmonks + Groq... (1-2 min)');
                    try {
                      const { data, error } = await supabase.functions.invoke('mycroft-punter-sportmonks', { body: {} });
                      if (error) throw error;
                      if (data?.success) {
                        const ap = data.approved ?? 0;
                        const tot = data.analyzed ?? 0;
                        const ve = data.vetoed ?? 0;
                        if (ap > 0) {
                          toast.success(`✅ Groq: ${ap} aprovados · ${ve} vetados (${tot} jogos)`);
                        } else {
                          toast.info(`Groq: 0 aprovados · ${ve} vetados (${tot} jogos)`);
                        }
                      } else {
                        toast.error(data?.error || 'Falha na análise Groq');
                      }
                    } catch (e: any) {
                      console.error('Groq analysis error', e);
                      toast.error(e?.message || 'Erro ao analisar via Groq');
                    } finally {
                      setSmLoading(false);
                    }
                  }}
                  disabled={smLoading || loading}
                  variant="outline"
                  className="w-full font-mono text-xs tracking-wider border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                >
                  {smLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ANALISANDO GROQ...</>
                  ) : (
                    <><BarChart3 className="mr-2 h-4 w-4" /> ANALISAR (GROQ · SPORTMONKS)</>
                  )}
                </Button>
                <p className="text-[10px] font-mono text-muted-foreground text-center">
                  🔒 Admin · Groq Llama 3.3 70B · Sportmonks Pro
                </p>
              </div>
            )}

            <Button
              onClick={analyzeCornersMarket}
              disabled={cornersLoading || loading}
              variant="outline"
              className="w-full font-mono text-xs tracking-wider border-primary/50 text-primary hover:bg-primary/10"
            >
              {cornersLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ANALISANDO ESCANTEIOS...</>
              ) : (
                <><CornerDownRight className="mr-2 h-4 w-4" /> ANALISAR ESCANTEIOS ({ANALYSIS_NT_COST} NT)</>
              )}
            </Button>

            {isAdmin && (
            <Button
              onClick={async () => {
                if (haLoading) return;
                setHaLoading(true);
                toast.info('🎯 Buscando oportunidades em Handicap Asiático... (pode levar até 2 min)');
                try {
                  const { data, error } = await supabase.functions.invoke('handicap-asiatico-edge', { body: { trigger: 'manual' } });
                  if (error) throw error;
                  if (data?.success) {
                    const aprov = data.aprovados ?? 0;
                    const total = data.jogos_analisados ?? 0;
                    if (aprov > 0) {
                      toast.success(`✅ ${aprov} oportunidades de HA encontradas (${total} jogos analisados)`);
                    } else {
                      toast.info(`Nenhuma oportunidade de HA aprovada (${total} jogos analisados)`);
                    }
                  } else {
                    toast.error(data?.error || 'Falha na análise de Handicap Asiático');
                  }
                } catch (e: any) {
                  console.error('HA analysis error', e);
                  toast.error(e?.message || 'Erro ao analisar Handicap Asiático');
                } finally {
                  setHaLoading(false);
                }
              }}
              disabled={haLoading || cornersLoading || loading}
              variant="outline"
              className="w-full font-mono text-xs tracking-wider border-warning/50 text-warning hover:bg-warning/10"
            >
              {haLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ANALISANDO HANDICAP ASIÁTICO...</>
              ) : (
                <><TrendingUpIcon className="mr-2 h-4 w-4" /> ANALISAR HANDICAP ASIÁTICO ({ANALYSIS_NT_COST} NT)</>
              )}
            </Button>
            )}

            {(signals.length > 0 || futureSignals.length > 0) && (
              <Button
                onClick={manualPlaceAllHorusBets}
                disabled={placingHorusBets || !bankroll || bankroll.balance <= 0}
                variant="outline"
                className="w-full font-mono text-xs tracking-wider border-primary/50 text-primary hover:bg-primary/10"
              >
                {placingHorusBets ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> EXECUTANDO ENTRADAS...</>
                ) : (
                  <><Bot className="mr-2 h-4 w-4" /> EXECUTAR ENTRADAS HÓRUS ({signals.length || futureSignals.length} entradas)</>
                )}
              </Button>
            )}

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
        )}

        {/* Schema validation error — bloqueia render quando punter_sinais está com shape inválido */}
        {schemaError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Erro de schema:</strong> {schemaError}
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* TodayResultsCard removido — disponível em /punter/feed-eventos */}


        {/* Portfolio Expected ROI Summary */}
        {signals.length > 0 && (
          <div className="space-y-4">
            {(() => {
              const scores = signals.map(s => calculateAssetScore({
                value_percentage: s.recommendation.value_percentage,
                confidence: s.recommendation.confidence,
                odd: s.recommendation.odd,
                bookmaker: s.recommendation.bookmaker,
                estimated_probability: s.recommendation.estimated_probability ?? undefined,
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

            {(() => {
              const todayStr = new Date().toDateString();
              // Mapeia stake_percentage → categoria A/B/C usando a MESMA fonte de verdade dos tiers
              // (getTierFromStake do tierLabels). Retorna null quando não há stake informado,
              // para evitar classificar incorretamente como "C" por causa de um default fixo.
              const categoryOf = (sp: number | null | undefined): 'A' | 'B' | 'C' | null => {
                if (sp == null || isNaN(Number(sp))) return null;
                const label = getTierFromStake(Number(sp)).label; // SINAL FORTE | SINAL BOM | SINAL MODERADO
                if (label === 'SINAL FORTE') return 'A';
                if (label === 'SINAL BOM') return 'B';
                if (label === 'SINAL MODERADO') return 'C';
                return null;
              };
              const visibleSignals = signals.filter((s) => {
                if (todayOnlyFilter && new Date(s.match.commence_time).toDateString() !== todayStr) return false;
                if (categoryFilter !== 'all') {
                  const sp = (s as any).recommendation?.stake_percentage;
                  const cat = categoryOf(sp);
                  if (cat !== categoryFilter) return false; // sem stake → não classifica em nenhuma categoria
                }
                return true;
              });
              const counts = signals.reduce(
                (acc, s) => {
                  const sp = (s as any).recommendation?.stake_percentage;
                  const cat = categoryOf(sp);
                  if (cat) acc[cat]++;
                  return acc;
                },
                { A: 0, B: 0, C: 0 } as Record<'A' | 'B' | 'C', number>,
              );
              const catBtn = (k: 'all' | 'A' | 'B' | 'C', label: string, count?: number) => (
                <button
                  key={k}
                  onClick={() => setCategoryFilter(k)}
                  className={cn(
                    'px-2 py-1 rounded font-mono text-[10px] border transition-colors',
                    categoryFilter === k
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30',
                  )}
                >
                  {label}{count !== undefined ? ` (${count})` : ''}
                </button>
              );
              return (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                      ATIVOS IDENTIFICADOS ({visibleSignals.length}{todayOnlyFilter ? ' • HOJE' : ''}{categoryFilter !== 'all' ? ` • CAT ${categoryFilter}` : ''})
                    </h2>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-success">
                      <CheckCircle2 className="w-3 h-3" />
                      APROVADOS
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground tracking-wider mr-1">CATEGORIA:</span>
                    {catBtn('all', 'TODAS', signals.length)}
                    {catBtn('A', '⚡ A · FORTE', counts.A)}
                    {catBtn('B', '✅ B · BOM', counts.B)}
                    {catBtn('C', '🎯 C · MODERADO', counts.C)}
                  </div>
                  {visibleSignals.length === 0 && (todayOnlyFilter || categoryFilter !== 'all') && (
                    <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                      Nenhum entrada com os filtros atuais. Ajuste os filtros para ver mais.
                    </div>
                  )}
                  {visibleSignals.map((signal, index) => {
              const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_').toLowerCase();
              const marketKey = (signal.recommendation.market || '').toLowerCase().replace(/\s+/g, '_');
              const manualKey = `${matchId}|${marketKey}`;
              const hasManualBet = manualBetMatchKeys.has(manualKey);
              const hasHorusBet = horusBetMatchKeys.has(manualKey) || autoPlacedMatchIds.has(manualKey);
              const hasPendingBet = hasManualBet; // só entrada MANUAL trava o botão / mostra "já registrada"
              const wasAutoPlaced = hasHorusBet;
              const kellyProb = signal.recommendation.estimated_probability
                ?? (signal.recommendation.fair_odd > 0 ? (1 / signal.recommendation.fair_odd) * 100 : (signal.recommendation.confidence || 55));
              const kelly = bankroll ? calculateKellyStake({
                probability: kellyProb,
                odd: signal.recommendation.odd,
                bankroll: bankroll.balance,
                fraction: 0.25,
              }) : null;
              const kellyStake = kelly?.stakeAmount || 0;
              const kellyPercent = kelly?.stakePercent || 3;

              // Get real bet stake from pending bets if Hórus already entered (match + market)
              const realBet = pendingBets.find((b: any) =>
                (b.match_id || '').toLowerCase() === matchId
                && (b.market || '').toLowerCase().replace(/\s+/g, '_') === marketKey
              );
              const realHorusStake = realBet ? parseFloat(realBet.stake) : kellyStake;
              const realBetDate = realBet ? new Date(realBet.created_at) : null;

              return (
                <div key={index} id={`signal-${matchId}`} className="space-y-1 transition-all duration-300">
                  <SignalCard
                    signal={signal}
                    onPlaceBetManual={(customStake: number) => placeBetManual(signal, customStake)}
                    bankroll={bankroll}
                    manualBankroll={manualBankroll}
                    isNew={!seenSignalIds.has(signalKey(signal))}
                    userAlreadyBet={hasPendingBet || wasAutoPlaced}
                    horusEntered={hasPendingBet || wasAutoPlaced}
                    horusStake={realHorusStake}
                    horusBetDate={realBetDate}
                    kellyPercent={kellyPercent}
                  />
                  {isAdvanced && (
                    <div className="flex justify-end px-1">
                      <SherlockAnalyticButton
                        homeTeam={signal.match.home_team}
                        awayTeam={signal.match.away_team}
                        market={signal.recommendation.market}
                        planName={(signal.recommendation as any).plan_name ?? ''}
                        analysisId={(signal as any).analysis_id ?? null}
                      />
                    </div>
                  )}
                </div>
              );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* Empty states */}
        {!loading && signals.length === 0 && totalAnalyzed > 0 && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-mono text-sm text-foreground mb-1">Nenhum ativo aprovado</p>
            <p className="font-mono text-xs text-muted-foreground mb-3">
              {totalAnalyzed} mercados escaneados. Nenhum com edge ≥5%.
            </p>
            <p className="font-mono text-[11px] text-primary">
              Próxima análise automática: <strong>{getNextPunterAnalysisWindow().label}</strong>
              {' '}({formatMinutesUntil(getNextPunterAnalysisWindow().minutesUntil)})
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

            {/* Empty state removed — primary "Analisar Mercado" button already conveys this */}

          </div>
        )}


        {/* Pending Positions removed — view in /punter/banca-virtual */}
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
        detailLink="/entradas"
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
function SignalCard({ signal, onPlaceBetManual, bankroll, manualBankroll, isNew, userAlreadyBet, horusEntered, horusStake, horusBetDate, kellyPercent }: {
  signal: PunterSignal;
  onPlaceBetManual: (stake: number) => void;
  bankroll: any;
  manualBankroll: any;
  isNew: boolean;
  userAlreadyBet: boolean;
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
    estimated_probability: signal.recommendation.estimated_probability ?? undefined,
  });
  const gradeConfig = getGradeConfig(assetScore.grade);

  const handleManualBet = () => {
    if (userAlreadyBet) {
      toast.info('Você já apostou neste entrada. Veja em "Minhas Entradas".');
      return;
    }
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
        {/* Top bar with tier signal + grade */}
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(() => {
              const tierInfo = getTierFromStake(stakePercent);
              return (
                <>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold border",
                    tierInfo.bgClass, tierInfo.textClass, tierInfo.borderClass
                  )}>
                    {tierInfo.icon} {tierInfo.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{tierInfo.sublabel}</span>
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
              gradeConfig.bg, gradeConfig.text, gradeConfig.border
            )}>
              {gradeConfig.emoji} {assetScore.grade}
            </span>
            {signal.recommendation.simulated_odds && (
              <span className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded">
                ⚠️ SIMULADAS
              </span>
            )}
            {isNew && !userAlreadyBet && (
              <span className="text-[10px] font-mono font-bold text-accent-foreground bg-accent border border-accent px-1.5 py-0.5 rounded animate-pulse">
                ● NOVO
              </span>
            )}
            {userAlreadyBet && (
              <span className="text-[10px] font-mono font-bold text-success bg-success/10 border border-success/40 px-1.5 py-0.5 rounded">
                ✓ JÁ APOSTADO
              </span>
            )}
            {horusEntered && !userAlreadyBet && (
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

          {/* Confidence bar */}
          {(() => {
            const tierInfo = getTierFromStake(stakePercent);
            const confidence = signal.recommendation.confidence ?? 70;
            const edge = signal.recommendation.value_percentage;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Confiança do Mycroft: {confidence}%</span>
                  {edge != null && <span className="text-muted-foreground">Vantagem: +{edge.toFixed(1)}%</span>}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(confidence, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={cn("h-full rounded-full", tierInfo.bgClass.replace('/15', ''))}
                  />
                </div>
                <p className={cn("text-[10px] font-mono", tierInfo.textClass)}>
                  Stake sugerido: {tierInfo.stakeLabel} · R$ {horusStake.toFixed(2)}
                </p>
              </div>
            );
          })()}

          {/* Data Grid */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
            <DataCell label="MERCADO" value={translateMarket(signal.recommendation.market)} />
            <DataCell label="CASA" value={signal.recommendation.bookmaker} />
            <DataCell label="ODD" value={signal.recommendation.odd?.toFixed(2)} highlight />
            <DataCell label="PROB." value={`${(signal.recommendation.estimated_probability ?? assetScore.model_probability).toFixed(1)}%`} />
            <DataCell label="EDGE" value={signal.recommendation.value_percentage != null ? `+${signal.recommendation.value_percentage.toFixed(1)}%` : 'N/A'} highlight />
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
              {horusStake > 0 && (
                <Button
                  type="button"
                  onClick={async () => {
                    const valor = horusStake.toFixed(2);
                    setCustomStake(valor);
                    let copiado = false;
                    try {
                      await navigator.clipboard.writeText(valor);
                      copiado = true;
                    } catch {}
                    toast.success(
                      copiado
                        ? `✅ R$ ${valor} copiado e preenchido na ENTRADA MANUAL`
                        : `✅ R$ ${valor} preenchido na ENTRADA MANUAL`,
                      {
                        description: copiado
                          ? 'Valor sugerido pelo Hórus pronto para colar na casa de entrada ou apostar na banca virtual.'
                          : 'Valor sugerido pelo Hórus aplicado no campo (cópia para a área de transferência indisponível).',
                        duration: 4000,
                      }
                    );
                  }}
                  variant="secondary"
                  size="sm"
                  className="h-10 px-2 font-mono text-[10px] gap-1.5 whitespace-nowrap border border-primary/40 bg-primary/10 hover:bg-primary/20"
                  title={`Stake sugerida pelo Hórus (4-5% da banca): R$ ${horusStake.toFixed(2)}`}
                >
                  <Copy className="w-3 h-3" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[8px] uppercase tracking-wider text-primary/80">Hórus · 4-5%</span>
                    <span className="font-bold">R$ {horusStake.toFixed(2)}</span>
                  </span>
                </Button>
              )}
              <Button
                onClick={handleManualBet}
                variant="outline"
                size="sm"
                className="h-8 px-3 font-mono text-xs"
                disabled={!manualBankroll || !customStake || userAlreadyBet}
                title={userAlreadyBet ? 'Você já apostou neste entrada' : undefined}
              >
                {userAlreadyBet ? '✓ APOSTADO' : 'APOSTAR'}
              </Button>
            </div>
            {userAlreadyBet ? (
              <p className="text-[10px] font-mono text-success/90 leading-tight">
                ✓ Entrada já registrada para este entrada — abra "Minhas Entradas" para acompanhar.
              </p>
            ) : horusStake > 0 && (
              <p className="text-[9px] font-mono text-muted-foreground/80 leading-tight">
                💡 Clique no valor R$ {horusStake.toFixed(2)} para copiar a mesma stake sugerida pelo Hórus.
              </p>
            )}
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
              {(() => {
                const mid = `${signal.match.home_team}_${signal.match.away_team}_${signal.match.commence_time}`.replace(/\s+/g, '_').replace(/\+00:00/g, 'Z').toLowerCase();
                return (
                  <>
                    <ExchangeEdgeBadge matchId={mid} market={signal.recommendation.market} className="mt-2" />
                    <SteamBadge matchId={mid} market={signal.recommendation.market} className="mt-1" />
                    <SportmonksPredictionBadge
                      mycroftProbability={signal.recommendation.estimated_probability ?? null}
                      sportmonksProbability={signal.recommendation.sportmonks_probability ?? null}
                      divergencePp={signal.recommendation.sportmonks_divergence_pp ?? null}
                      sherlockAlert={signal.recommendation.sherlock_alert ?? false}
                      className="mt-1"
                    />
                  </>
                );
              })()}
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
  // Status real: status pode ser 'pending'|'settled'|'cancelled'; result fica 'green'|'red'|'void' quando liquidada
  const isGreen = (b: any) => b.result === 'green' || b.status === 'green';
  const isRed = (b: any) => b.result === 'red' || b.status === 'red';
  const isPending = (b: any) => b.status === 'pending';

  const filtered = bets.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return isPending(b);
    if (filter === 'green') return isGreen(b);
    if (filter === 'red') return isRed(b);
    return true;
  });

  const greens = bets.filter(isGreen).length;
  const reds = bets.filter(isRed).length;
  const totalPL = bets.reduce((sum: number, b: any) => sum + (parseFloat(b.profit_loss) || 0), 0);
  const cumulativeROI = initialBalance > 0 ? (totalPL / initialBalance * 100) : 0;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getScoreGrade = (bet: any) => {
    // Use stored asset_score if available, otherwise recalculate
    const storedScore = bet.asset_score ? parseInt(bet.asset_score) : null;
    if (storedScore) {
      const grade = storedScore >= 80 ? 'A+' : storedScore >= 70 ? 'A' : storedScore >= 60 ? 'B' : 'C';
      return { score: storedScore, grade, config: getGradeConfig(grade) };
    }
    const score = calculateAssetScore({
      value_percentage: 60,
      confidence: 65,
      odd: parseFloat(bet.odd),
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
              <p className="text-sm">Nenhuma entrada encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((bet: any, i: number) => {
                  const status = bet.result || bet.status;
                  const { score, grade, config } = getScoreGrade(bet);
                  const cumROI = cumulativeMap.get(bet.id);
                  const hasFinalScore = bet.score_home != null && bet.score_away != null;

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
                            <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">
                              {hasFinalScore ? `PEND ${bet.score_home}-${bet.score_away}` : 'PENDENTE'}
                            </Badge>
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