-- Adiciona campos de liquidação na punter_analyses
ALTER TABLE public.punter_analyses
  ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('GREEN','RED','VOID') OR result IS NULL),
  ADD COLUMN IF NOT EXISTS final_score_home integer,
  ADD COLUMN IF NOT EXISTS final_score_away integer,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS profit_loss numeric,
  ADD COLUMN IF NOT EXISTS sent_green_to_telegram boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS green_telegram_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS settle_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_settle_attempt_at timestamptz;

-- Index pra acelerar queries de liquidação
CREATE INDEX IF NOT EXISTS idx_punter_analyses_settle 
  ON public.punter_analyses (verdict, result, commence_time) 
  WHERE verdict = 'APROVADO' AND result IS NULL;

CREATE INDEX IF NOT EXISTS idx_punter_analyses_green_unsent 
  ON public.punter_analyses (result, sent_green_to_telegram) 
  WHERE result IN ('GREEN','RED') AND sent_green_to_telegram = false;