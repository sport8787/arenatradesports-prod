import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Lock, ChevronRight, Gift, Calendar, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

// Catálogo de prêmios — espelha BlackMarket.tsx (ordenado por priceValue)
const PRIZES = [
  { id: 7, name: '7 Dias Premium Grátis', priceValue: 8000, icon: Calendar, badge: 'NOVO' },
  { id: 2, name: '30 Dias Premium Grátis', priceValue: 25000, icon: Calendar, badge: 'POPULAR' },
  { id: 1, name: 'Vale-Presente R$ 50', priceValue: 35000, icon: Gift, badge: null },
  { id: 3, name: 'Vale-Presente R$ 100', priceValue: 70000, icon: Gift, badge: null },
  { id: 4, name: 'Gift Card R$ 200', priceValue: 130000, icon: Gift, badge: null },
  { id: 5, name: 'Premium VIP (Tudo Liberado)', priceValue: 150000, icon: Crown, badge: 'TOP' },
  { id: 6, name: 'Camisa Oficial do Seu Time', priceValue: 180000, icon: Crown, badge: null },
];

/**
 * Card de progresso do próximo prêmio na Liga Mycroft.
 * - Mostra saldo BC atual
 * - Próximo prêmio que o usuário pode resgatar
 * - Barra de progresso e quanto falta
 * - CTA para Liga Mycroft
 */
export default function NextPrizeProgress() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaid, isTrialActive } = useSubscription();
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

    // Realtime: atualiza ao receber BC novo
    const channel = supabase
      .channel(`bc-progress-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (active && payload.new?.bc_balance !== undefined) {
            setBc(payload.new.bc_balance);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (bc === null) {
    return <div className="rounded-xl border border-yellow-500/20 bg-card/40 p-4 animate-pulse h-32" />;
  }

  // Próximo prêmio = primeiro cujo priceValue > bc atual; se já alcançou todos, mostra topo
  const nextPrize = PRIZES.find((p) => p.priceValue > bc) ?? PRIZES[PRIZES.length - 1];
  const reachedAll = bc >= PRIZES[PRIZES.length - 1].priceValue;
  const previousThreshold = (() => {
    const previous = [...PRIZES].reverse().find((p) => p.priceValue <= bc);
    return previous?.priceValue ?? 0;
  })();
  const span = nextPrize.priceValue - previousThreshold;
  const progressInSpan = Math.max(0, bc - previousThreshold);
  const pct = reachedAll ? 100 : Math.min(100, Math.round((progressInSpan / Math.max(span, 1)) * 100));
  const remaining = Math.max(0, nextPrize.priceValue - bc);
  const Icon = nextPrize.icon;

  return (
    <button
      onClick={() => navigate('/loja-bc')}
      className="w-full text-left rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10 p-4 hover:border-yellow-500/50 transition group"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-yellow-500/20 p-2.5">
          <Trophy className="h-5 w-5 text-yellow-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-mono uppercase tracking-wider text-yellow-400 font-bold">
              Liga Mycroft · Seu Progresso
            </p>
            <ChevronRight className="h-4 w-4 text-yellow-400/60 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition" />
          </div>

          {reachedAll ? (
            <p className="text-sm font-semibold text-emerald-400">
              🎉 Você já tem BC para o maior prêmio!
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                Próximo: <span className="text-yellow-400">{nextPrize.name}</span>
                {nextPrize.badge && (
                  <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    {nextPrize.badge}
                  </span>
                )}
              </p>

              {/* Saldo + faltam */}
              <div className="mt-2 flex items-baseline justify-between gap-2 text-xs font-mono">
                <span className="text-foreground">
                  <span className="text-yellow-400 font-bold">{bc.toLocaleString('pt-BR')}</span>
                  <span className="text-muted-foreground"> / {nextPrize.priceValue.toLocaleString('pt-BR')} BC</span>
                </span>
                <span className="text-muted-foreground">
                  faltam <span className="text-foreground font-semibold">{remaining.toLocaleString('pt-BR')} BC</span>
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="mt-1.5 h-2 rounded-full bg-card/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}

          {!isPaid && (
            <p className="mt-2 text-[10px] text-amber-400/90 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {isTrialActive
                ? 'Você acumula BC no Trial. Resgate é só para assinantes.'
                : 'Resgate liberado apenas para assinantes.'}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
