import posthog from 'posthog-js';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const;
type UtmKey = typeof UTM_KEYS[number];
export type UtmData = Partial<Record<UtmKey, string>> & { landing_page?: string; first_seen_at?: string };

const STORAGE_KEY = 'attribution_first_touch';
const SESSION_KEY = 'attribution_last_touch';

/**
 * Captura UTMs da URL e persiste:
 * - first_touch (localStorage): NUNCA sobrescreve. Atribuição "real" do criativo que trouxe.
 * - last_touch (sessionStorage): atualiza a cada visita. Útil pra ver re-engajamento.
 * Registra como super-properties no PostHog (vão em TODOS os eventos automaticamente).
 */
export function captureUTMs(): UtmData {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const current: UtmData = {};

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) current[key] = value.slice(0, 200); // safety cap
  });

  const hasUtm = Object.keys(current).length > 0;

  // First touch (apenas se ainda não existe)
  let firstTouch: UtmData = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) firstTouch = JSON.parse(stored);
  } catch {}

  if (hasUtm && !firstTouch.utm_source && !firstTouch.fbclid && !firstTouch.gclid) {
    firstTouch = {
      ...current,
      landing_page: window.location.pathname,
      first_seen_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(firstTouch));
    } catch {}
  }

  // Last touch (sempre atualiza se houver UTMs)
  if (hasUtm) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, landing_page: window.location.pathname }));
    } catch {}
  }

  // Registra super-properties no PostHog (vão em TODOS os eventos)
  if (firstTouch.utm_source || firstTouch.fbclid) {
    const superProps: Record<string, string> = {};
    Object.entries(firstTouch).forEach(([k, v]) => {
      if (v) superProps[`first_${k}`] = v;
    });
    Object.entries(current).forEach(([k, v]) => {
      if (v) superProps[`last_${k}`] = v;
    });
    try {
      posthog.register(superProps);
    } catch {}
  }

  return firstTouch;
}

export function getFirstTouch(): UtmData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function getLastTouch(): UtmData {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Retorna props de atribuição para anexar manualmente em eventos críticos
 * (signup, checkout). PostHog já manda automaticamente via super-properties,
 * mas anexar manualmente garante que apareçam mesmo se super-props falharem.
 */
export function getAttributionProps(): Record<string, string> {
  const first = getFirstTouch();
  const last = getLastTouch();
  const out: Record<string, string> = {};
  Object.entries(first).forEach(([k, v]) => {
    if (v) out[`first_${k}`] = v;
  });
  Object.entries(last).forEach(([k, v]) => {
    if (v) out[`last_${k}`] = v;
  });
  return out;
}
