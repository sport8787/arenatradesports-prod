import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import DualBankrollDashboard from '@/components/punter/DualBankrollDashboard';
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
          .from('bets_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'horus')
          .eq('result', 'pending'),
        supabase
          .from('bets_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'manual')
          .eq('result', 'pending'),
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
            onClick={() => navigate('/punter/funcoes')}
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

      <main className="container mx-auto px-4 py-6 max-w-5xl">
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
