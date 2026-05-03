import { useNavigate } from 'react-router-dom';
import { Coins, Wallet, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Banner persistente que explica:
 *  - Banca virtual + banca real coexistem (uma não anula a outra)
 *  - Cada APOSTA VIRTUAL VENCEDORA acumula BluffCoins (BC)
 *  - BC são trocados por prêmios reais na Loja BC (PIX, GiftCard, PS5, iPhone…)
 *
 * Mostra também o saldo atual de BC do usuário.
 */
export default function BCRewardsBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bc, setBc] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from('profiles')
      .select('bc_balance')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setBc(data.bc_balance ?? 0);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-3 sm:p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-yellow-500/20 p-2">
          <Coins className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Liga Mycroft: cada GREEN virtual vira BluffCoins reais 🏆
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">
            Use a <span className="font-medium text-foreground">Banca Virtual</span> em paralelo
            com sua banca real — uma não anula a outra. A cada{' '}
            <span className="font-medium text-emerald-400">GREEN</span> você acumula{' '}
            <span className="font-medium text-yellow-400">+50 BC base + bônus pelo lucro</span>.
            Troque por <span className="font-medium">vale-presentes, 30 dias grátis, upgrade Premium</span>{' '}
            e dispute o <span className="font-medium text-yellow-400">troféu físico da temporada</span>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/punter/banca-virtual')}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 hover:bg-primary/25 px-3 py-1.5 text-xs font-medium text-primary transition"
            >
              <Wallet className="h-3.5 w-3.5" />
              Configurar banca virtual
              <ChevronRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => navigate('/loja-bc')}
              className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500/15 hover:bg-yellow-500/25 px-3 py-1.5 text-xs font-medium text-yellow-400 transition"
            >
              <Coins className="h-3.5 w-3.5" />
              Liga Mycroft
              {bc !== null && (
                <span className="ml-1 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-mono">
                  {bc.toLocaleString('pt-BR')} BC
                </span>
              )}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
