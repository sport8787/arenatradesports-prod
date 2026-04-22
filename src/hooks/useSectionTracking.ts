import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * Dispara `landing_section_viewed` no PostHog quando a seção entra no viewport (>=50%).
 * Fira apenas uma vez por carregamento de página.
 *
 * @param stage  Nome da etapa do funil (ex: 'hero', 'video', 'prova_brutal', 'pricing', 'cta_final')
 * @param threshold  Fração visível para disparar (default 0.5)
 */
export function useSectionTracking<T extends HTMLElement = HTMLDivElement>(
  stage: string,
  threshold = 0.5,
) {
  const ref = useRef<T | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || firedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            track.sectionViewed(stage);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stage, threshold]);

  return ref;
}
