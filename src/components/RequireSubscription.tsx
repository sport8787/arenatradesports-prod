import { useSubscription } from '@/hooks/useSubscription';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';
import { ReactNode } from 'react';

interface RequireSubscriptionProps {
  children: ReactNode;
}

export function RequireSubscription({ children }: RequireSubscriptionProps) {
  const { hasAccess, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Briefcase className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
}
