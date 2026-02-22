import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function TrialBanner() {
  const { isTrialActive, isTrialExpired, daysLeft, isPaid, loading } = useSubscription();

  if (loading || isPaid) return null;
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

  const iconClass = textClass;

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
        isUrgent && 'animate-pulse'
      )}
    >
      {isTrialExpired || isUrgent ? (
        <AlertTriangle className={cn('w-4 h-4 shrink-0', iconClass)} />
      ) : (
        <Clock className={cn('w-4 h-4 shrink-0', iconClass)} />
      )}

      <span className={textClass}>
        {urgencyText} — {message}
      </span>

      <Link to="/upgrade">
        <Button
          size="sm"
          variant={isUrgent || isTrialExpired ? 'default' : 'outline'}
          className={cn(
            'h-7 text-xs gap-1',
            !(isUrgent || isTrialExpired) && 'border-current'
          )}
        >
          <Sparkles className="w-3 h-3" />
          Assinar com 50% OFF
        </Button>
      </Link>
    </motion.div>
  );
}
