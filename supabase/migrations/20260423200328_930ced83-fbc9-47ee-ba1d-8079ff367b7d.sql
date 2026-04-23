-- 1. Índice único para impedir duplicação de análises (mesmo jogo + mesmo mercado)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_punter_analyses_match_market
  ON public.punter_analyses (match_id, market);

-- 2. Índice único para sinais (camada extra de proteção)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_punter_signals_match_market
  ON public.punter_signals (match_id, market);