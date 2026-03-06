import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Loader2, BarChart3, Calendar, DollarSign, 
  CheckCircle2, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Wallet, ArrowLeft, Brain, Clock, History, TrendingDown, XCircle, Activity, LayoutGrid, FlaskConical
} from 'lucide-react';
import BacktestPanel from '@/components/punter/BacktestPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import GoldButton from '@/components/game/GoldButton';
import BankrollWidget from '@/components/arena-trader/BankrollWidget';
import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
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
  const [aiProvider, setAiProvider] = useState<'gemini' | 'anthropic'>('gemini');

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

  const analyzeGames = async () => {
    if (!user) {
      setError('Você precisa estar logado para analisar jogos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hoursAhead = timeWindow === '15min' ? 0.25 : 48;
      const { data, error: fnError } = await supabase.functions.invoke('mycroft-punter-analysis', {
        body: {
          hours_ahead: hoursAhead,
          bookmakers: ['bet365', 'pinnacle', 'betfair'],
          min_value: 5,
          ai_provider: aiProvider,
        }
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      setSignals(data.signals || []);
      setTotalAnalyzed(data.total_analyzed || 0);
      setTotalApproved(data.total_approved || 0);
      toast.success(`${data.total_approved} sinais aprovados de ${data.total_analyzed} jogos analisados`);
    } catch (err: any) {
      console.error('Erro ao analisar jogos:', err);
      setError(err.message || 'Erro ao conectar com Mycroft Punter');
    } finally {
      setLoading(false);
    }
  };

  const placeBet = useCallback(async (signal: PunterSignal) => {
    if (!bankroll || !user) {
      toast.error('Banca não carregada');
      return;
    }
    const stakePercent = signal.recommendation.stake_percentage || 3;
    const stake = Math.round(bankroll.balance * (stakePercent / 100) * 100) / 100;
    if (stake > bankroll.balance || stake <= 0) {
      toast.error('Saldo insuficiente');
      return;
    }
    const matchName = `${signal.match.home_team} vs ${signal.match.away_team}`;
    const matchId = `${signal.match.home_team}_${signal.match.away_team}`.replace(/\s+/g, '_');

    // Cancel any conflicting pending bet for the same match
    const { data: existingBets } = await supabase
      .from('virtual_bets_punter')
      .select('id, stake')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .eq('status', 'pending');

    if (existingBets && existingBets.length > 0) {
      // Refund old stakes and cancel old bets
      const totalRefund = existingBets.reduce((sum: number, b: any) => sum + parseFloat(b.stake), 0);
      await supabase
        .from('virtual_bets_punter')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', existingBets.map((b: any) => b.id));

      // Refund to bankroll
      await supabase.from('user_bankroll').update({
        balance: bankroll.balance + totalRefund,
        total_staked: Math.max(0, bankroll.total_staked - totalRefund),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      // Update local bankroll ref
      bankroll.balance += totalRefund;
      bankroll.total_staked = Math.max(0, bankroll.total_staked - totalRefund);
      toast.info(`Aposta anterior em ${matchName} cancelada e estornada`);
    }

    // Insert bet with thesis
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
    if (betError) {
      toast.error(betError.message);
      return;
    }
    // Update bankroll
    await supabase.from('user_bankroll').update({
      balance: bankroll.balance - stake,
      total_staked: bankroll.total_staked + stake,
      total_bets: bankroll.total_bets + 1,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    toast.success(`Aposta de R$ ${stake.toFixed(2)} registrada em ${matchName}`);
    // Refresh pending bets
    const { data: updated } = await supabase
      .from('virtual_bets_punter')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (updated) setPendingBets(updated);
  }, [bankroll, user]);

  if (showBacktest) {
    return <BacktestPanel onClose={() => setShowBacktest(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-success" />
              <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
                Arena Punter
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bankroll && (
              <div className="flex items-center gap-1.5 text-sm">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="font-orbitron font-bold text-foreground">
                  R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/apostas')}>
              <Wallet className="w-4 h-4 mr-1" />
              Apostas
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={openHistory}>
              <History className="w-4 h-4 mr-1" />
              Histórico
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={handleSettleBets} disabled={settlingBets}>
              {settlingBets ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Liquidar
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => setShowBacktest(true)}>
              <Activity className="w-4 h-4 mr-1" />
              Simulado
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => setIsChatOpen(true)}>
              <Brain className="w-4 h-4 mr-1" />
              KB
            </GoldButton>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-4xl">
        {/* Bankroll Widget */}
        {bankroll && !bankrollLoading && <BankrollWidget bankroll={bankroll} onUpdateBalance={updateInitialBalance} />}

        {/* Info Banner */}
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground/80">
              <span className="font-bold text-success">Value Betting Pré-Jogo</span> — Mycroft Punter analisa jogos 
              futuros e identifica odds com value positivo em múltiplos mercados (1x2, Over/Under). Stake recomendado: 2-5% da banca.
            </p>
          </CardContent>
        </Card>

        {/* Analyze Button */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-orbitron">Analisar Jogos (Todas as Ligas + PE)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Time Window Toggle */}
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

            <GoldButton onClick={analyzeGames} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando com IA...</>
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

        {/* Signals */}
        {signals.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-orbitron font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Sinais Aprovados ({signals.length})
            </h2>
            {signals.map((signal, index) => (
              <SignalCard key={index} signal={signal} onPlaceBet={() => placeBet(signal)} bankroll={bankroll} />
            ))}
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
                      <p className="font-bold text-foreground">{bet.match_name}</p>
                      <p className="text-sm text-muted-foreground">{bet.market}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-orbitron font-bold text-primary">R$ {bet.stake.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Odd: {bet.odd}</p>
                    </div>
                  </div>
                  <Badge className="mt-2 bg-primary/10 text-primary border-primary/30">Pendente</Badge>
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

// Signal Card Component
function SignalCard({ signal, onPlaceBet, bankroll }: { signal: PunterSignal; onPlaceBet: () => void; bankroll: any }) {
  const [expanded, setExpanded] = useState(false);
  const commenceDate = new Date(signal.match.commence_time);
  const isToday = commenceDate.toDateString() === new Date().toDateString();
  const stakePercent = signal.recommendation.stake_percentage || 3;
  const stakeValue = bankroll ? Math.round(bankroll.balance * (stakePercent / 100) * 100) / 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-success/30 hover:border-success/50 transition-all">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-1 text-foreground">
                {signal.match.home_team} vs {signal.match.away_team}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {isToday ? 'Hoje' : commenceDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    {' às '}
                    {commenceDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-orbitron font-bold text-success">
                +{signal.recommendation.value_percentage?.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Value</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <InfoBox label="Mercado" value={signal.recommendation.market} icon={<Target className="w-3.5 h-3.5" />} />
            <InfoBox label="Casa" value={signal.recommendation.bookmaker} />
            <InfoBox label="Odd" value={signal.recommendation.odd?.toFixed(2)} highlight />
            <InfoBox label="Stake" value={`${stakePercent}% (R$ ${stakeValue.toFixed(0)})`} icon={<DollarSign className="w-3.5 h-3.5" />} />
          </div>

          {/* Confidence Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Confiança</span>
              <span className="font-bold text-foreground">{signal.recommendation.confidence}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-success to-primary rounded-full transition-all"
                style={{ width: `${signal.recommendation.confidence}%` }}
              />
            </div>
          </div>

          {/* Thesis */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-1">💡 Tese:</p>
            <p className="text-sm text-foreground/80">{signal.recommendation.thesis}</p>
          </div>

          {/* Bet Button */}
          <GoldButton onClick={onPlaceBet} className="w-full" disabled={!bankroll || stakeValue <= 0}>
            <DollarSign className="w-4 h-4 mr-1" />
            ENTREI — Apostar R$ {stakeValue.toFixed(2)} ({stakePercent}% da banca)
          </GoldButton>

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
                  <div>Odd oferecida: <span className="font-mono">{signal.recommendation.odd}</span> → Prob. implícita: <span className="font-mono">{(100 / signal.recommendation.odd).toFixed(1)}%</span></div>
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

function InfoBox({ label, value, icon, highlight = false }: { label: string; value: string | number; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? 'bg-success/10 border border-success/20' : 'bg-secondary/30'}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-sm font-bold ${highlight ? 'text-success text-base' : 'text-foreground'}`}>{value}</div>
    </div>
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
          {/* Stats row */}
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

          {/* Filter tabs */}
          <Tabs value={filter} onValueChange={v => onFilterChange(v as any)}>
            <TabsList className="bg-secondary/50 w-full">
              <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1">Pendentes</TabsTrigger>
              <TabsTrigger value="green" className="flex-1">Green</TabsTrigger>
              <TabsTrigger value="red" className="flex-1">Red</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Bet list */}
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
