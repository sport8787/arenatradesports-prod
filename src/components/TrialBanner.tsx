import { useSubscription } from '@/hooks/useSubscription';
import { Clock, AlertTriangle, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

export function TrialBanner() {
  const { subscription, loading, daysLeft, isTrialActive, isTrialExpired, isPaid } = useSubscription();

  if (loading || !subscription) return null;
  if (isPaid) return null;

  if (isTrialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium"
      >
        <AlertTriangle className="w-4 h-4" />
        Seu trial expirou. Assine um plano para continuar usando.
      </motion.div>
    );
  }

  if (isTrialActive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-primary/10 border border-primary/30 text-primary px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Clock className="w-4 h-4" />
        Trial gratuito — {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
      </motion.div>
    );
  }

  return null;
}
