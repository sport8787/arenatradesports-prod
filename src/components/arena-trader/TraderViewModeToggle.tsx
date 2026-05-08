import { Eye, Settings2 } from 'lucide-react';
import { useTraderViewMode } from '@/hooks/useTraderViewMode';
import { cn } from '@/lib/utils';

/**
 * Toggle Simples vs Avançado para Arena Trader Sports.
 */
export default function TraderViewModeToggle({ className }: { className?: string }) {
  const { isSimple, toggle } = useTraderViewMode();

  return (
    <button
      onClick={toggle}
      title={isSimple
        ? 'Modo Simples ativo — clique para ver banca, posições, chips e painéis avançados'
        : 'Modo Avançado ativo — clique para esconder painéis e ver só tabs + jogos'}
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
