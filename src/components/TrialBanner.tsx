import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Clock, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PLAN_LABEL: Record<string, string> = {
  starter: 'STARTER',
  base: 'BASE',
  premium: 'PREMIUM',
  trial: 'TRIAL',
};

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function TrialBanner() {
  const {
    subscription,
    isTrialActive,
    isTrialExpired,
    daysLeft,
    isPaid,
    loading,
  } = useSubscription();

  if (loading) return null;

  // ───────────── Plano PAGO ativo (Kiwify ou ativação manual) ─────────────
  if (isPaid && subscription) {
    const plan = PLAN_LABEL[subscription.plan] || subscription.plan.toUpperCase();
    const endsAt = formatDateBR(subscription.subscription_ends_at);
    const isEndingSoon = daysLeft > 0 && daysLeft <= 7;

    const bgClass = isEndingSoon
      ? 'bg-yellow-500/10 border-yellow-500/40'
      : 'bg-emerald-500/10 border-emerald-500/40';
    const textClass = isEndingSoon ? 'text-yellow-400' : 'text-emerald-400';

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'w-full border-b px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium z-50',
          bgClass,
        )}
      >
        <CheckCircle2 className={cn('w-4 h-4 shrink-0', textClass)} />
        <span className={textClass}>
          ✅ Plano <strong>{plan}</strong> ativo — válido até{' '}
          <strong>{endsAt}</strong>
          {daysLeft > 0 && (
            <> ({daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'})</>
          )}
        </span>
        {isEndingSoon && (
          <Link to="/oferta-especial">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-current">
              <Sparkles className="w-3 h-3" />
              Renovar
            </Button>
          </Link>
        )}
      </motion.div>
    );
  }

  // ───────────── Trial ativo / expirado ─────────────
  if (!isTrialActive && !isTrialExpired) return null;

  const isUrgent = daysLeft <= 2;
  const isWarning = daysLeft <= 4 && daysLeft > 2;

  const bgClass = isTrialExpired || isUrgent
    ? 'bg-red-500/10 border-red-500/40'
    : isWarning
    ? 'bg-yellow-500/10 border-yellow-500/40'
    : 'bg-blue-500/10 border-blue-500/40';

  const textClass = isTrialExpired || isUrgent
    ? 'text-red-400'
    : isWarning
    ? 'text-yellow-400'
    : 'text-blue-400';

  const urgencyText = isTrialExpired
    ? '🚫 Trial expirado'
    : isUrgent
    ? '🔥 URGENTE'
    : isWarning
    ? '⚠️ ATENÇÃO'
    : '⏰';

  const message = isTrialExpired
    ? 'Seu trial expirou. Assine para continuar.'
    : `Seu trial termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'w-full border-b px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium z-50',
        bgClass,
        isUrgent && 'animate-pulse',
      )}
    >
      {isTrialExpired || isUrgent ? (
        <AlertTriangle className={cn('w-4 h-4 shrink-0', textClass)} />
      ) : (
        <Clock className={cn('w-4 h-4 shrink-0', textClass)} />
      )}

      <span className={textClass}>
        {urgencyText} — {message}
      </span>

      <Link to="/oferta-especial">
        <Button
          size="sm"
          variant={isUrgent || isTrialExpired ? 'default' : 'outline'}
          className={cn(
            'h-7 text-xs gap-1',
            !(isUrgent || isTrialExpired) && 'border-current',
          )}
        >
          <Sparkles className="w-3 h-3" />
          {isTrialExpired ? 'Ganhar 50% OFF' : 'Assinar com 50% OFF'}
        </Button>
      </Link>
    </motion.div>
  );
}

