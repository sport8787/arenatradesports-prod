import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFavorites } from '@/hooks/useFavorites';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FavoriteButtonProps {
  /** Lista de chaves a alternar — todas serão togglada juntas (ex: matchId + home + away). */
  keys: (string | null | undefined)[];
  /** Tamanho do ícone. */
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

export default function FavoriteButton({ keys, size = 'md', className, label }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const validKeys = keys.filter((k): k is string => !!k && k.trim().length > 0);
  const active = validKeys.some((k) => isFavorite(k));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (validKeys.length === 0) return;
    // Se já está favoritado, remove TODAS as chaves; senão adiciona TODAS.
    if (active) {
      validKeys.forEach((k) => isFavorite(k) && toggle(k));
    } else {
      validKeys.forEach((k) => !isFavorite(k) && toggle(k));
    }
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            aria-label={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center justify-center rounded-md transition-all',
              'hover:bg-primary/10 hover:scale-110',
              btnSize,
              active ? 'text-primary' : 'text-muted-foreground/60 hover:text-primary',
              className,
            )}
          >
            <Star className={cn(iconSize, active && 'fill-primary')} />
            {label && <span className="ml-1 text-xs font-orbitron">{label}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{active ? 'Remover dos favoritos' : 'Favoritar (fixar no topo)'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
