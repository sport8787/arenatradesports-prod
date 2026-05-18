CREATE TABLE IF NOT EXISTS public.sportmonks_odds_cache (
  fixture_id BIGINT PRIMARY KEY,
  match_date TIMESTAMPTZ,
  odds JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_real_odds BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sportmonks_odds_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access odds cache"
ON public.sportmonks_odds_cache
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read odds cache"
ON public.sportmonks_odds_cache
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_sportmonks_odds_cache_date 
ON public.sportmonks_odds_cache(match_date);