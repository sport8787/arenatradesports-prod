CREATE TABLE IF NOT EXISTS public.sportmonks_inplay_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fixture_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sportmonks_inplay_cache TO service_role;

ALTER TABLE public.sportmonks_inplay_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_inplay_cache"
  ON public.sportmonks_inplay_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);