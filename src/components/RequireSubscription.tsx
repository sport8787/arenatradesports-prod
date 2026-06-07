import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';
import { ReactNode } from 'react';

interface RequireSubscriptionProps {
  children: ReactNode;
}

export function RequireSubscription({ children }: RequireSubscriptionProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading, subscription } = useSubscription();
  const location = useLocation();

  // Mostra splash enquanto auth ou subscription/admin estão carregando.
  // useSubscription.loading já inclui adminLoading + authLoading, então quando
  // loading=false temos a resposta definitiva. Não usar subscription===null como
  // critério adicional pois causa spinner infinito para usuários sem assinatura.
  const stillResolving = authLoading || loading;

  if (stillResolving) {
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

  // Bloqueia acesso direto sem autenticação → manda para /auth
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  // Força troca de senha se admin marcou must_change_password
  if (
    (user.user_metadata as any)?.must_change_password === true &&
    location.pathname !== '/trocar-senha'
  ) {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (!hasAccess) {
    // Usuário logado sem assinatura → oferta Day Pass (R$ 9,90 / 24h)
    return <Navigate to="/lobby-preview" replace />;
  }

  return <>{children}</>;
}

