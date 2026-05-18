import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Bot, User, CheckCircle2, Activity, Trophy, Award, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import DualBankrollDashboard from '@/components/punter/DualBankrollDashboard';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PunterBancaVirtualPage() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { bankroll, loading: bankrollLoading, updateInitialBalance } = useBankroll();
  const {
    bankroll: manualBankroll,
    loading: manualLoading,
    updateInitialBalance: updateManualBalance,
  } = useManualBankroll();

  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [manualPendingBets, setManualPendingBets] = useState<any[]>([]);
  const [settling, setSettling] = useState(false);

  const reloadPending = async () => {
    if (!user) return;
    const [{ data: horus }, { data: manual }] = await Promise.all([
      supabase.from('virtual_bets_punter').select('*').eq('user_id', user.id).eq('status', 'pending'),
      supabase.from('virtual_bets_manual').select('*').eq('user_id', user.id).eq('status', 'pending'),
    ]);
    setPendingBets(horus || []);
    setManualPendingBets(manual || []);
  };

  const isRetryableError = (err: any): boolean => {
    const msg = (err?.message || String(err || '')).toLowerCase();
    return (
      msg.includes('cpu time') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('time exceeded') ||
      msg.includes('worker') ||
      msg.includes('boot') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror')
    );
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const invokeSettleWithRetry = async (tId: string | number) => {
    const maxAttempts = 4; // 1 inicial + 3 retries
    const baseDelay = 1500; // ms
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('settle-bets', {
          body: { attempt },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (error) throw error;
        return data;
      } catch (e: any) {
        lastErr = e;
        const retryable = isRetryableError(e);
        if (!retryable || attempt === maxAttempts) throw e;

        // Backoff exponencial com jitter: 1.5s, 3s, 6s (+ até 500ms)
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        toast.loading(
          `Tentativa ${attempt} falhou (${e?.message?.slice(0, 60) || 'timeout'}). Retentando em ${(delay / 1000).toFixed(1)}s...`,
          { id: tId }
        );
        await sleep(delay);
      }
    }
    throw lastErr;
  };

  const handleSettleAll = async () => {
    if (settling) return;
    setSettling(true);
    const tId = toast.loading('Liquidando entradas pendentes (Hórus + Minha Banca)...');
    try {
      const data = await invokeSettleWithRetry(tId);
      toast.success('Liquidação concluída', {
        id: tId,
        description: `Apostas liquidadas: ${data?.settled ?? 0} | Sinais: ${data?.signals_settled ?? 0} | Ignoradas: ${data?.skipped ?? 0}`,
      });
      await reloadPending();
    } catch (e: any) {
      toast.error('Falha ao liquidar após múltiplas tentativas', {
        id: tId,
        description: e?.message || String(e),
      });
    } finally {
      setSettling(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    reloadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLoading = bankrollLoading || manualLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter/menu')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            CONFIGURAR BANCA VIRTUAL
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Funções', to: '/punter/funcoes' }, { label: 'Configurar Banca Virtual' }]} />

        {/* Aviso BC: cada GREEN virtual vira BluffCoins */}
        <div className="rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 px-4 py-3 flex items-start gap-3">
          <span className="text-2xl leading-none">🪙</span>
          <div className="flex-1 text-xs text-muted-foreground">
            <p className="text-foreground font-medium mb-0.5">A banca virtual paga em BluffCoins (BC)</p>
            <p>
              Cada aposta virtual vencedora rende{' '}
              <span className="text-yellow-400 font-medium">+50 BC base + bônus pelo lucro</span>{' '}
              (até 500 BC/aposta). Acumule e troque por <span className="text-foreground">PIX, GiftCard, PS5 e iPhone</span> na{' '}
              <button onClick={() => navigate('/loja-bc')} className="underline text-yellow-400 hover:text-yellow-300">
                Loja BC
              </button>
              . Use em paralelo à sua banca real — uma não anula a outra.
            </p>
          </div>
        </div>

        {/* Atalhos para ferramentas relacionadas */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
            Ferramentas relacionadas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
            <QuickBtn icon={<FileText className="w-3.5 h-3.5" />} label="Análise Manual" onClick={() => navigate('/punter/analise-manual')} />
            <QuickBtn icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Sinais Liquidados" onClick={() => navigate('/punter')} />
            <QuickBtn icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Auditoria de Apostas" onClick={() => navigate('/punter/auditoria')} />
            <QuickBtn icon={<TrendingUp className="w-3.5 h-3.5" />} label="Método dos Ciclos" onClick={() => navigate('/punter/ciclos')} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
            Painéis rápidos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <QuickBtn icon={<Bot className="w-3.5 h-3.5" />} label="Posições Hórus" onClick={() => navigate('/punter?panel=horus-positions')} />
            <QuickBtn icon={<User className="w-3.5 h-3.5" />} label="Minhas Posições" onClick={() => navigate('/punter?panel=my-positions')} />
            <QuickBtn
              icon={settling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              label={settling ? 'Liquidando...' : 'Liquidar'}
              onClick={handleSettleAll}
              disabled={settling}
            />
            <QuickBtn icon={<Activity className="w-3.5 h-3.5" />} label="Backtest" onClick={() => navigate('/punter?panel=backtest')} />
            <QuickBtn icon={<Trophy className="w-3.5 h-3.5" />} label="Ranking" onClick={() => navigate('/punter?panel=rankings')} />
            <QuickBtn icon={<Award className="w-3.5 h-3.5" />} label="Cert." onClick={() => navigate('/punter?panel=certificate')} />
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : bankroll && manualBankroll ? (
          <DualBankrollDashboard
            horus={bankroll}
            manual={manualBankroll}
            horusPendingBets={pendingBets}
            manualPendingBets={manualPendingBets}
            onUpdateHorusBalance={updateInitialBalance}
            onUpdateManualBalance={updateManualBalance}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground font-mono text-sm">
            Não foi possível carregar a banca.
          </div>
        )}
      </main>
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md border border-border bg-card hover:bg-card/70 hover:border-primary/40 text-foreground transition-colors text-[11px] font-mono font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
