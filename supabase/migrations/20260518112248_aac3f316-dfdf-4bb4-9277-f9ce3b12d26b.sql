CREATE TABLE IF NOT EXISTS public.sportmonks_fixtures_cache (
  league_key TEXT NOT NULL,
  season INT NOT NULL,
  league_name TEXT NOT NULL,
  fixtures JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixture_count INT NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_key, season)
);

ALTER TABLE public.sportmonks_fixtures_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access fixtures cache"
ON public.sportmonks_fixtures_cache
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read fixtures cache"
ON public.sportmonks_fixtures_cache
FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_sportmonks_fixtures_cache_complete
ON public.sportmonks_fixtures_cache(is_complete, fetched_at);