import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mycroft.favorites.v1';

type Listener = (favs: Set<string>) => void;
const listeners = new Set<Listener>();

function readStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeStorage(favs: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favs)));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Hook de favoritos (times ou partidas) persistido em localStorage.
 * Compartilhado entre componentes via subscribers — ao favoritar em um lugar,
 * todos os outros componentes re-renderizam imediatamente.
 *
 * Use uma chave estável: para times use o nome normalizado (ex: "Flamengo"),
 * para partidas use o `match_id` ou `fixture_id`.
 */
export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(() => readStorage());

  useEffect(() => {
    const listener: Listener = (next) => setFavs(new Set(next));
    listeners.add(listener);

    // Sync entre abas
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFavs(readStorage());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback((key: string) => {
    if (!key) return;
    const current = readStorage();
    if (current.has(key)) current.delete(key);
    else current.add(key);
    writeStorage(current);
    listeners.forEach((l) => l(current));
  }, []);

  const isFavorite = useCallback((key: string) => favs.has(key), [favs]);

  /**
   * Verifica se um jogo é favorito por qualquer uma das chaves possíveis
   * (matchId, time da casa, time visitante).
   */
  const isMatchFavorite = useCallback(
    (opts: { matchId?: string | null; home?: string | null; away?: string | null }) => {
      if (opts.matchId && favs.has(opts.matchId)) return true;
      if (opts.home && favs.has(opts.home)) return true;
      if (opts.away && favs.has(opts.away)) return true;
      return false;
    },
    [favs],
  );

  return { favs, toggle, isFavorite, isMatchFavorite };
}
