/**
 * Cache leve em sessionStorage para snapshots de UI (números, contagens, listas).
 *
 * Objetivo: evitar que widgets "pisquem" ou voltem a zero quando o usuário
 * troca de aba e retorna. O cache persiste por toda a sessão do navegador
 * e tem um TTL configurável para revalidação em background.
 *
 * Uso típico:
 *   const cached = readCache<Stats>('menu-hero', 5 * 60_000);
 *   if (cached) setStats({ ...cached, loading: false });
 *   const fresh = await fetchStats();
 *   setStats({ ...fresh, loading: false });
 *   writeCache('menu-hero', fresh);
 */

interface Envelope<T> {
  v: 1;
  ts: number;
  data: T;
}

const PREFIX = 'lov-cache:';

export function readCache<T>(key: string, maxAgeMs?: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (env?.v !== 1 || typeof env.ts !== 'number') return null;
    if (maxAgeMs && Date.now() - env.ts > maxAgeMs) return null;
    return env.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const env: Envelope<T> = { v: 1, ts: Date.now(), data };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    // sessionStorage cheio ou indisponível — silencioso
  }
}

export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

/** Idade do registro em ms (ou null se não existir). */
export function cacheAge(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<unknown>;
    if (typeof env?.ts !== 'number') return null;
    return Date.now() - env.ts;
  } catch {
    return null;
  }
}
