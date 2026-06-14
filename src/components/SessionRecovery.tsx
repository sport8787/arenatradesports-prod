import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * SessionRecovery
 *
 * Persiste a última rota visitada em sessionStorage. Se a página for
 * recarregada (por crash, deploy novo, ou hard-reload manual) e o usuário
 * cair em uma rota diferente da última conhecida, restaura a rota anterior.
 *
 * Convive bem com o visibilityManager: trocar de aba NÃO recarrega, então
 * este componente fica inerte na maior parte do tempo.
 */
const KEY = 'lov-session:last-route';
const SCROLL_KEY = 'lov-session:last-scroll';
const SHOULD_RESTORE_KEY = 'lov-session:should-restore';

export default function SessionRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  // Restaura rota/scroll em reloads reais ou quando a URL cai em "/" por acidente.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      const shouldRestore = sessionStorage.getItem(SHOULD_RESTORE_KEY) === '1';
      if (!saved) return;
      const current = window.location.pathname + window.location.search;
      if ((shouldRestore || current === '/') && current !== saved && saved !== '/' && !saved.startsWith('/?')) {
        navigate(saved, { replace: true });
      }
      sessionStorage.removeItem(SHOULD_RESTORE_KEY);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva rota atual a cada navegação
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, location.pathname + location.search);
    } catch {
      /* noop */
    }
  }, [location.pathname, location.search]);

  // Salva scroll antes de qualquer descarregamento
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(SHOULD_RESTORE_KEY, '1');
        sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      } catch {
        /* noop */
      }
    };
    // Apenas pagehide — beforeunload desabilita o Back-Forward Cache do browser,
    // causando reload completo ao voltar para a aba/app. pagehide cobre os
    // mesmos cenários (navegação real + kill de aba) sem quebrar o BFCache.
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // Restaura scroll após navegação recuperada ou reload real.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (raw) {
        const y = Number(raw);
        if (!Number.isNaN(y) && y > 0) {
          let attempts = 0;
          const restore = () => {
            requestAnimationFrame(() => {
              window.scrollTo(0, y);
              attempts += 1;
              const delta = Math.abs(window.scrollY - y);
              if (delta > 4 && attempts < 8) restore();
            });
          };
          restore();
        }
        sessionStorage.removeItem(SCROLL_KEY);
      }
    } catch {
      /* noop */
    }
  }, [location.key]);

  return null;
}
