-- Indexes to eliminate seq scans on mycroft_analyses
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_match_verdict_created
  ON public.mycroft_analyses (match_id, verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_verdict_created
  ON public.mycroft_analyses (verdict, created_at DESC)
  WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA');

ANALYZE public.mycroft_analyses;
ANALYZE public.scheduled_games;
ANALYZE public.live_matches;