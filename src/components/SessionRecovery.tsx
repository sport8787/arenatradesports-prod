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

export default function SessionRecovery() {
  const location = useLocation();
  const navigate = useNavigate();

  // Restaura rota apenas no primeiro mount, se a URL atual for "/" mas havia uma rota salva
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (!saved) return;
      // Só restaura se o usuário caiu em "/" sem querer (ex.: F5 num ambiente que perdeu o path)
      // e a rota salva era diferente. Não interfere em navegação normal.
      const current = window.location.pathname + window.location.search;
      if (current === '/' && saved !== '/' && !saved.startsWith('/?')) {
        navigate(saved, { replace: true });
      }
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
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      } catch {
        /* noop */
      }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, []);

  // Restaura scroll uma vez por sessão
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (raw) {
        const y = Number(raw);
        if (!Number.isNaN(y) && y > 0) {
          // Aguarda render para garantir altura da página
          requestAnimationFrame(() => window.scrollTo(0, y));
        }
        sessionStorage.removeItem(SCROLL_KEY);
      }
    } catch {
      /* noop */
    }
  }, []);

  return null;
}
