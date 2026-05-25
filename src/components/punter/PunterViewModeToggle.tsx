import { Eye, Settings2 } from 'lucide-react';
import { usePunterViewMode } from '@/hooks/usePunterViewMode';
import { cn } from '@/lib/utils';

/**
 * Toggle Simples vs Avançado.
 * - Simples: mostra apenas entradas e resultados (UX limpa para usuário novo).
 * - Avançado: revela painéis técnicos (Backtest, Sherlock, Debug).
 */
export default function PunterViewModeToggle({ className }: { className?: string }) {
  const { isSimple, toggle } = usePunterViewMode();

  return (
    <button
      onClick={toggle}
      title={isSimple ? 'Modo Simples ativo — clique para ver painéis avançados' : 'Modo Avançado ativo — clique para ocultar painéis técnicos'}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-mono font-semibold transition-colors',
        isSimple
          ? 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60'
          : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20',
        className,
      )}
    >
      {isSimple ? <Eye className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isSimple ? 'Simples' : 'Avançado'}</span>
    </button>
  );
}
