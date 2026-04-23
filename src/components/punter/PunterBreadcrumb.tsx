import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  items: Crumb[];
  className?: string;
}

/**
 * Breadcrumb consistente para subpáginas da Arena Punter.
 * Sempre inicia com "Arena Punter" → ...itens.
 */
export default function PunterBreadcrumb({ items, className }: Props) {
  const crumbs: Crumb[] = [{ label: 'Arena Punter', to: '/punter' }, ...items];
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 font-mono text-[11px] text-muted-foreground ${className ?? ''}`}
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <div key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
            {i === 0 && <Home className="w-3 h-3 shrink-0" aria-hidden />}
            {c.to && !isLast ? (
              <Link
                to={c.to}
                className="hover:text-foreground transition-colors truncate"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'text-foreground font-semibold truncate' : 'truncate'}
                aria-current={isLast ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />}
          </div>
        );
      })}
    </nav>
  );
}
