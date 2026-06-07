import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Zap, ArrowUpRight } from 'lucide-react';
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

  // Bloqueado — distingue usuário sem assinatura (Day Pass) de usuário com plano diferente
  const noSubscription = !subscription;
  const enabledLabels = allowedArenas.map((a) => ARENA_AVAILABLE_TEXT[a]).filter(Boolean);

  // Arenas cobertas pelo Day Pass (R$ 9,90 / 24h)
  const DAY_PASS_ARENAS: ArenaKey[] = ['arena_punter', 'arena_live'];
  const isAvailableOnDayPass = DAY_PASS_ARENAS.includes(arena);

  if (noSubscription && isAvailableOnDayPass) {
    // Oferta Day Pass para usuários sem assinatura
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-primary/30 rounded-xl bg-card p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-mono text-base font-semibold text-foreground mb-1">
            {arenaLabel} disponível
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-5">
            Libere acesso à <span className="text-foreground font-semibold">Arena Punter</span> e{' '}
            <span className="text-foreground font-semibold">Arena Live</span> por{' '}
            <span className="text-primary font-bold">24 horas</span> por apenas
          </p>
          <div className="mb-5">
            <span className="font-mono text-4xl font-bold text-primary">R$ 9</span>
            <span className="font-mono text-2xl font-bold text-primary">,90</span>
          </div>
          <ul className="font-mono text-[10px] text-muted-foreground space-y-1 mb-6 text-left max-w-xs mx-auto">
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Sinais ao vivo com Mycroft
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Análises pré-live (Arena Punter)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Banca virtual + BC coins
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span> Acesso completo por 24 horas
            </li>
          </ul>
          <div className="flex gap-2 justify-center">
            <a
              href="/lobby-preview"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-mono text-xs font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3.5 h-3.5" /> Quero acesso por R$ 9,90
            </a>
          </div>
          <a href="/menu" className="block mt-3 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Voltar ao menu
          </a>
        </div>
      </div>
    );
  }

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
        <div className="flex gap-2 justify-center">
          <a
            href="/lobby-preview"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-mono text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Day Pass R$ 9,90 <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <a
            href="/menu"
            className="inline-flex items-center font-mono text-xs px-4 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            Voltar
          </a>
        </div>
      </div>
    </div>
  );
}
