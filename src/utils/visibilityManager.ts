/**
 * visibilityManager
 *
 * Substitui qualquer comportamento de "recarregar a página" ao trocar de aba
 * por um evento customizado `app:revalidate` que componentes interessados
 * podem ouvir para refazer fetchs LEVES sem desmontar a árvore React.
 *
 * Também intercepta F5 / Ctrl+R / Cmd+R: previne o reload completo do
 * navegador e dispara o mesmo evento de revalidação. Isso mantém a rota,
 * o scroll e o estado da aplicação.
 *
 * Importante: o ErrorBoundary continua podendo chamar location.reload()
 * em caso de crash fatal — isso é intencional.
 */

export const REVALIDATE_EVENT = 'app:revalidate';
export const LEGACY_FOCUS_EVENT = 'app:focus';

type RevalidateReason = 'visibility' | 'focus' | 'hotkey' | 'manual';

export interface RevalidateDetail {
  reason: RevalidateReason;
  at: number;
}

let installed = false;
let lastDispatch = 0;

function dispatchRevalidate(reason: RevalidateReason) {
  const now = Date.now();
  // throttle 2s para não martelar quando o SO dispara focus+visibility juntos
  if (now - lastDispatch < 2000) return;
  lastDispatch = now;
  try {
    window.dispatchEvent(
      new CustomEvent<RevalidateDetail>(REVALIDATE_EVENT, {
        detail: { reason, at: now },
      })
    );
    window.dispatchEvent(
      new CustomEvent<RevalidateDetail>(LEGACY_FOCUS_EVENT, {
        detail: { reason, at: now },
      })
    );
  } catch {
    /* noop */
  }
}

export function setupVisibilityManager(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (installed) return () => {};
  installed = true;

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      dispatchRevalidate('visibility');
    }
  };

  const onFocus = () => {
    dispatchRevalidate('focus');
  };

  const onPageShow = () => {
    dispatchRevalidate('focus');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // F5
    const isF5 = e.key === 'F5';
    // Ctrl+R / Cmd+R (mas NÃO Ctrl+Shift+R: deixa o hard-reload manual passar)
    const isReload =
      (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'r' || e.key === 'R');
    if (isF5 || isReload) {
      e.preventDefault();
      e.stopPropagation();
      dispatchRevalidate('hotkey');
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('keydown', onKeyDown, { capture: true });

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    installed = false;
  };
}

/** Helper para componentes: registra um listener tipado. */
export function onRevalidate(handler: (detail: RevalidateDetail) => void): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<RevalidateDetail>).detail);
  window.addEventListener(REVALIDATE_EVENT, wrapped);
  return () => window.removeEventListener(REVALIDATE_EVENT, wrapped);
}

/** Permite disparar revalidação manualmente (ex.: pull-to-refresh). */
export function triggerRevalidate(reason: RevalidateReason = 'manual') {
  dispatchRevalidate(reason);
}
