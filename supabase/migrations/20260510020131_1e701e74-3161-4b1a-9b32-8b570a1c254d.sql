-- Índice parcial para o SELECT de update-live-odds e similares.
-- Filtra apenas jogos AO VIVO, drasticamente menor que a tabela inteira (4k+ rows).
CREATE INDEX IF NOT EXISTS idx_live_matches_status_minute_live
  ON public.live_matches (minute)
  WHERE status = 'live';

-- Índice para o filtro de cached_odds_games (expires_at futuro)
CREATE INDEX IF NOT EXISTS idx_cached_odds_games_active
  ON public.cached_odds_games (expires_at, commence_time)
  WHERE expires_at > '2025-01-01'::timestamptz;