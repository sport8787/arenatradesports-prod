import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowUpRight } from 'lucide-react';
import { useSubscription, type ArenaKey } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';

interface RequireArenaProps {
  arena: ArenaKey;
  arenaLabel: string; // ex: "Arena Punter", "Gerador de Múltiplas"
  children: ReactNode;
}

const ARENA_AVAILABLE_TEXT: Record<ArenaKey, string> = {
  arena_live: 'Arena Live',
  arena_punter: 'Arena Punter',
  multiplas: 'Gerador de Múltiplas',
  banca_virtual: 'Banca Virtual',
  banca_real: 'Banca Real',
};

export function RequireArena({ arena, arenaLabel, children }: RequireArenaProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasArena, loading, allowedArenas, subscription } = useSubscription();
  const location = useLocation();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Lock className="w-8 h-8 text-muted-foreground" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  if (hasArena(arena)) {
    return <>{children}</>;
  }

  // Bloqueado
  const enabledLabels = allowedArenas.map((a) => ARENA_AVAILABLE_TEXT[a]).filter(Boolean);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-border rounded-xl bg-card p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="font-mono text-base font-semibold text-foreground mb-2">
          {arenaLabel} bloqueada
        </h1>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
          Seu plano <span className="text-primary font-semibold">
            {(subscription?.plan || 'trial').toUpperCase()}
          </span> só dá direito a{' '}
          <span className="text-foreground font-semibold">
            {enabledLabels.length > 0 ? enabledLabels.join(', ') : '—'}
          </span>.
          <br />
          Caso deseje usar essa função, faça upgrade.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed mb-4 italic">
          Lembrete: durante o trial, todas as arenas ficam liberadas por cortesia. Após o trial,
          o acesso passa a respeitar o plano contratado.
        </p>
        <div className="flex gap-2 justify-center">
          <a
            href="/paywall"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-mono text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Fazer upgrade <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <a
            href={allowedArenas.includes('arena_live') ? '/arena-trader-sports' : '/lobby'}
            className="inline-flex items-center font-mono text-xs px-4 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            Voltar
          </a>
        </div>
      </div>
    </div>
  );
}
