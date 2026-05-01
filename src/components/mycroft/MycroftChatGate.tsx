import { Lock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';

interface MycroftChatGateProps {
  /** Conteúdo do chat liberado quando o usuário tem acesso */
  children: React.ReactNode;
  /** Variante visual: "panel" (card cheio) ou "inline" (compacto dentro de outro card) */
  variant?: 'panel' | 'inline';
  /** Mensagem opcional sobrescrevendo o padrão */
  title?: string;
}

/**
 * Gate de acesso ao Chat com Mycroft.
 * Liberado APENAS para: Admin OU plano Premium pago.
 * Trial / Starter / Base / Free → bloqueado com CTA de upgrade.
 *
 * Regra registrada em mem://features/mycroft-chat/access-restriction
 */
export default function MycroftChatGate({
  children,
  variant = 'panel',
  title,
}: MycroftChatGateProps) {
  const { isPaid, subscription, loading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (loading || adminLoading) {
    return (
      <div className="p-6 text-center text-xs text-white/40">
        Verificando acesso...
      </div>
    );
  }

  const canUse = isAdmin || (isPaid && subscription?.plan === 'premium');

  if (canUse) return <>{children}</>;

  const containerCls =
    variant === 'inline'
      ? 'p-4 text-center space-y-2 border-t border-amber-900/20'
      : 'p-6 text-center space-y-3 rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent';

  return (
    <div className={containerCls}>
      <div className="flex items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-amber-400/60" />
        <Sparkles className="w-4 h-4 text-amber-400/60" />
      </div>
      <p className="text-sm font-semibold text-amber-400">
        {title ?? 'Chat com Mycroft é exclusivo Premium'}
      </p>
      <p className="text-xs text-white/60 max-w-sm mx-auto">
        O Mycroft só conversa com assinantes <strong className="text-amber-400">Premium</strong>.
        Faça upgrade e libere o debate completo com o oráculo — geral e dentro de cada partida.
      </p>
      <div className="flex items-center justify-center gap-2 pt-1">
        <Link
          to="/oferta-especial"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Liberar Premium 50% OFF
        </Link>
        <Link
          to="/planos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:text-white hover:border-white/30 transition-colors"
        >
          Ver planos
        </Link>
      </div>
      {variant === 'panel' && (
        <p className="text-[10px] text-white/30">
          Já é Premium? Recarregue a página ou saia e entre novamente.
        </p>
      )}
    </div>
  );
}
