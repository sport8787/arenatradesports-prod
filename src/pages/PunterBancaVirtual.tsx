import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Bot, User, CheckCircle2, Activity, Trophy, Award } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import DualBankrollDashboard from '@/components/punter/DualBankrollDashboard';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { supabase } from '@/integrations/supabase/client';

export default function PunterBancaVirtualPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bankroll, loading: bankrollLoading, updateInitialBalance } = useBankroll();
  const {
    bankroll: manualBankroll,
    loading: manualLoading,
    updateInitialBalance: updateManualBalance,
  } = useManualBankroll();

  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [manualPendingBets, setManualPendingBets] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: horus }, { data: manual }] = await Promise.all([
        supabase
          .from('virtual_bets_punter')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('virtual_bets_manual')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending'),
      ]);
      setPendingBets(horus || []);
      setManualPendingBets(manual || []);
    })();
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

        {/* Atalhos rápidos para painéis no /punter */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
            Painéis rápidos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <QuickBtn icon={<Bot className="w-3.5 h-3.5" />} label="Posições Hórus" onClick={() => navigate('/punter?panel=horus-positions')} />
            <QuickBtn icon={<User className="w-3.5 h-3.5" />} label="Minhas Posições" onClick={() => navigate('/punter?panel=my-positions')} />
            <QuickBtn icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Liquidar" onClick={() => navigate('/punter?panel=settle')} />
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md border border-border bg-card hover:bg-card/70 hover:border-primary/40 text-foreground transition-colors text-[11px] font-mono font-semibold"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
