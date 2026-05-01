import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PunterBackButtonProps {
  className?: string;
  to?: string;
  ariaLabel?: string;
}

/**
 * Botão de voltar reutilizável para todas as telas do modo Punter
 * (Arena Punter + Arena Trader Sports). Sempre navega para /menu
 * por padrão, garantindo um fluxo de retorno consistente.
 */
export default function PunterBackButton({
  className,
  to = '/menu',
  ariaLabel = 'Voltar para o menu Punter',
}: PunterBackButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={ariaLabel}
      className={cn(
        'text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
