import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, XCircle, Target, Loader2, Sparkles, Lightbulb, Activity, Clock,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBetImport } from '@/hooks/useBetImport';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import BetfairConfig from '@/components/punter/BetfairConfig';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';

interface AnalysisResult {
  success: boolean;
  stats: {
    total_bets: number;
    settled: number;
    pending: number;
    greens: number;
    reds: number;
    total_pl: number;
    total_stake: number;
    roi_pct: number;
    avg_clv_pct: number;
    aligned_won: number;
    aligned_lost: number;
    against_signal: number;
    no_signal: number;
    ignored_vetoes: number;
    blind_entries: number;
  };
  insights: string;
  bets: Array<{
    id: string;
    home_team: string | null;
    away_team: string | null;
    market: string;
    odd: number;
    stake: number;
    result: string | null;
    profit_loss: number | null;
    alignment: string;
    clv_pct: number | null;
    error_tags: string[];
    matched_signal: { verdict: string; thesis: string } | null;
    placed_at: string | null;
  }>;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
interface SyncState {
  status: SyncStatus;
  lastRunAt: string | null;
  lastSyncedCount: number | null;
  lastError: string | null;
  startedAt: number | null;
}

export default function PunterBetfairReal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { syncBetfair, syncing } = useBetImport();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sync, setSync] = useState<SyncState>({
    status: 'idle',
    lastRunAt: null,
    lastSyncedCount: null,
    lastError: null,
    startedAt: null,
  });
  const [elapsed, setElapsed] = useState(0);

  // Carrega último status de sync da tabela bookmaker_connections
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('bookmaker_connections')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('bookmaker', 'betfair')
        .maybeSingle();
      if (data?.last_sync_at) {
        setSync(s => ({ ...s, lastRunAt: data.last_sync_at, status: 'success' }));
      }
      loadCachedAnalysis();
    })();
  }, [user]);

  // Cronômetro durante a sincronização
  useEffect(() => {
    if (sync.status !== 'syncing' || !sync.startedAt) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (sync.startedAt || 0)) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [sync.status, sync.startedAt]);

  const loadCachedAnalysis = async () => {
    if (!user) return;
    try {
      await runAnalysis(false);
    } catch {
      /* ignore */
    }
  };

  const handleSync = async (force = false) => {
    setSync({
      status: 'syncing',
      lastRunAt: sync.lastRunAt,
      lastSyncedCount: null,
      lastError: null,
      startedAt: Date.now(),
    });
    const r = await syncBetfair(force);
    if (r.success) {
      setSync({
        status: 'success',
        lastRunAt: new Date().toISOString(),
        lastSyncedCount: r.synced ?? 0,
        lastError: null,
        startedAt: null,
      });
      toast.success(`${r.synced} entradas sincronizadas`);
      runAnalysis(true);
    } else {
      setSync(s => ({
        ...s,
        status: 'error',
        lastError: r.error || 'Erro desconhecido',
        startedAt: null,
      }));
      toast.error(r.error || 'Erro ao sincronizar');
    }
  };

  const runAnalysis = async (showToast = true) => {
    if (!user) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-real-bets');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as AnalysisResult);
      if (showToast) toast.success('Análise concluída');
    } catch (e: any) {
      if (showToast) toast.error(`Erro: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter/funcoes')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
              APOSTAS REAIS BETFAIR
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-4xl space-y-4">
        <PunterBreadcrumb
          items={[
            { label: 'Funções', to: '/punter/funcoes' },
            { label: 'Entradas Reais Betfair' },
          ]}
        />

        {!user ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Faça login para acessar.
          </p>
        ) : (
          <>
            {/* CARD 1 — Sincronização Betfair */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟡</span>
                <h2 className="font-mono text-sm font-bold text-foreground">
                  SINCRONIZAR COM A BETFAIR
                </h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure suas credenciais (App Key + SSOID) e sincronize automaticamente
                todas as suas entradas reais. Apenas dados desta seção serão analisados.
              </p>
              <BetfairConfig userId={user.id} />
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => handleSync(false)}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncing && 'animate-spin')} />
                  {syncing ? 'Sincronizando…' : 'Sincronizar'}
                </Button>
                <Button
                  onClick={() => handleSync(true)}
                  disabled={syncing}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncing && 'animate-spin')} />
                  Re-sync Completo
                </Button>
              </div>

              <SyncStatusPanel sync={sync} elapsed={elapsed} />
            </Card>

            {/* CARD 2 — Análise Hórus */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="font-mono text-sm font-bold text-foreground">
                    ANÁLISE DO HÓRUS PUNTER
                  </h2>
                </div>
                <Button
                  onClick={() => runAnalysis(true)}
                  disabled={analyzing}
                  size="sm"
                >
                  {analyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Brain className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {analyzing ? 'Analisando…' : 'Analisar Entradas'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O Hórus cruza suas entradas reais com os entradas aprovados/vetados da Arena
                Trader Sports, identifica padrões de erro e sugere correções.
              </p>

              {result && <AnalysisResultPanel result={result} />}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function AnalysisResultPanel({ result }: { result: AnalysisResult }) {
  const { stats, insights, bets } = result;

  if (stats.total_bets === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <Target className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">
          Nenhuma entrada Betfair encontrada. Sincronize primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPI label="Total" value={stats.total_bets.toString()} />
        <KPI
          label="ROI"
          value={`${stats.roi_pct >= 0 ? '+' : ''}${stats.roi_pct.toFixed(1)}%`}
          tone={stats.roi_pct >= 0 ? 'success' : 'destructive'}
        />
        <KPI
          label="P/L"
          value={`${stats.total_pl >= 0 ? '+' : ''}${stats.total_pl.toFixed(2)}`}
          tone={stats.total_pl >= 0 ? 'success' : 'destructive'}
        />
        <KPI
          label="CLV médio"
          value={`${stats.avg_clv_pct >= 0 ? '+' : ''}${stats.avg_clv_pct.toFixed(1)}%`}
          tone={stats.avg_clv_pct >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {/* Comparação ATS */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <p className="font-mono text-[10px] text-muted-foreground uppercase">
          Comparativo com Arena Trader Sports
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Stat icon={CheckCircle} tone="success" label="Aprovadas vencedoras" value={stats.aligned_won} />
          <Stat icon={XCircle} tone="destructive" label="Aprovadas perdedoras" value={stats.aligned_lost} />
          <Stat icon={AlertTriangle} tone="warning" label="Ignorou veto" value={stats.ignored_vetoes} />
          <Stat icon={Target} tone="muted" label="Entrada cega" value={stats.blind_entries} />
        </div>
      </div>

      {/* Insights da IA */}
      {insights && (
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <p className="font-mono text-xs font-bold text-primary uppercase">
              Diagnóstico do Hórus
            </p>
          </div>
          <div className="text-xs text-foreground leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Lista de entradas analisadas */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            Últimas {bets.length} Entradas Analisadas
          </p>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {bets.map(bet => (
            <BetRow key={bet.id} bet={bet} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'destructive' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-secondary/30 border border-border rounded-lg p-2.5"
    >
      <p className="text-[9px] font-mono text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          'font-mono text-base font-bold',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </p>
    </motion.div>
  );
}

function Stat({
  icon: Icon, tone, label, value,
}: { icon: any; tone: 'success' | 'destructive' | 'warning' | 'muted'; label: string; value: number }) {
  const colorMap = {
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  };
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('w-3.5 h-3.5 shrink-0', colorMap[tone])} />
      <div className="min-w-0">
        <p className="font-mono text-sm font-bold text-foreground">{value}</p>
        <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

function BetRow({ bet }: { bet: AnalysisResult['bets'][number] }) {
  const won = bet.result === 'green' || bet.result === 'won';
  const lost = bet.result === 'red' || bet.result === 'lost';
  const alignmentBadge: Record<string, { label: string; tone: string }> = {
    aligned_won: { label: 'Alinhado ✓', tone: 'bg-success/15 text-success border-success/30' },
    aligned_lost: { label: 'Aprovado RED', tone: 'bg-warning/15 text-warning border-warning/30' },
    against_signal: { label: 'Contra veto', tone: 'bg-destructive/15 text-destructive border-destructive/30' },
    no_signal: { label: 'Sem entrada', tone: 'bg-muted/30 text-muted-foreground border-border' },
    pending: { label: 'Pendente', tone: 'bg-muted/30 text-muted-foreground border-border' },
  };
  const badge = alignmentBadge[bet.alignment];

  return (
    <div className="px-3 py-2.5 hover:bg-secondary/20 transition-colors">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          {won && <CheckCircle className="w-3.5 h-3.5 text-success" />}
          {lost && <XCircle className="w-3.5 h-3.5 text-destructive" />}
          {!won && !lost && <Target className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {bet.home_team || '?'} vs {bet.away_team || '?'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{bet.market}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {badge && (
              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4', badge.tone)}>
                {badge.label}
              </Badge>
            )}
            {bet.error_tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30">
                {tag.replace(/_/g, ' ')}
              </Badge>
            ))}
            {bet.clv_pct != null && (
              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4', bet.clv_pct >= 0 ? 'bg-success/10 text-success border-success/30' : 'bg-muted/30 text-muted-foreground border-border')}>
                CLV {bet.clv_pct >= 0 ? '+' : ''}{bet.clv_pct.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono font-bold text-foreground">@{bet.odd.toFixed(2)}</p>
          {bet.profit_loss != null && (
            <p className={cn('text-[10px] font-mono font-bold', (bet.profit_loss || 0) >= 0 ? 'text-success' : 'text-destructive')}>
              {(bet.profit_loss || 0) >= 0 ? '+' : ''}{bet.profit_loss.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SyncStatusPanel({ sync, elapsed }: { sync: SyncState; elapsed: number }) {
  const statusMeta: Record<SyncStatus, { label: string; tone: string; dot: string; icon: any }> = {
    idle: { label: 'Aguardando', tone: 'text-muted-foreground', dot: 'bg-muted-foreground', icon: Clock },
    syncing: { label: 'Sincronizando…', tone: 'text-warning', dot: 'bg-warning animate-pulse', icon: Loader2 },
    success: { label: 'Sucesso', tone: 'text-success', dot: 'bg-success', icon: CheckCircle },
    error: { label: 'Falhou', tone: 'text-destructive', dot: 'bg-destructive', icon: XCircle },
  };
  const meta = statusMeta[sync.status];
  const Icon = meta.icon;

  const formatRelative = (iso: string | null) => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `há ${Math.floor(diff)}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="border border-border rounded-lg bg-secondary/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Status da Sincronização
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
          <span className={cn('font-mono text-[10px] font-bold uppercase', meta.tone)}>
            {meta.label}
          </span>
        </div>
      </div>

      {sync.status === 'syncing' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>Em execução…</span>
            <span>{elapsed}s</span>
          </div>
          <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-warning animate-[slide_1.4s_ease-in-out_infinite] rounded-full"
              style={{ animation: 'pulse 1.4s ease-in-out infinite' }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Última execução</p>
          <p className="text-[11px] font-mono font-semibold text-foreground">
            {formatRelative(sync.lastRunAt)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Importadas</p>
          <p className="text-[11px] font-mono font-semibold text-foreground">
            {sync.lastSyncedCount != null ? sync.lastSyncedCount : '—'}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Resultado</p>
          <div className="flex items-center gap-1">
            <Icon className={cn('w-3 h-3', meta.tone, sync.status === 'syncing' && 'animate-spin')} />
            <span className={cn('text-[11px] font-mono font-semibold', meta.tone)}>
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {sync.lastError && (
        <div className="text-[10px] font-mono text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1">
          {sync.lastError}
        </div>
      )}
    </div>
  );
}
