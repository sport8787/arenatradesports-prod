CREATE TABLE IF NOT EXISTS public.fixture_stats_cache (
  fixture_id TEXT PRIMARY KEY,
  stats JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '25 seconds')
);

CREATE INDEX IF NOT EXISTS idx_fixture_stats_cache_expires_at
  ON public.fixture_stats_cache (expires_at);

ALTER TABLE public.fixture_stats_cache ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role (which bypasses RLS) can read/write.

CREATE OR REPLACE FUNCTION public.cleanup_expired_fixture_stats_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.fixture_stats_cache WHERE expires_at < now() - interval '5 minutes';
$$;