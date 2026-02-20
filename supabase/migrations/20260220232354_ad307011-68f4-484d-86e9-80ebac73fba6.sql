
-- Cache table for AI responses (hand analysis + training scenarios)
CREATE TABLE public.ai_response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  function_name TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  hit_count INTEGER NOT NULL DEFAULT 0
);

-- Index for fast lookups
CREATE INDEX idx_ai_cache_key ON public.ai_response_cache (cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_response_cache (expires_at);

-- Enable RLS
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Public read (cache is shared across users for same hands)
CREATE POLICY "Cache is readable by anyone"
ON public.ai_response_cache FOR SELECT USING (true);

-- Only service role can insert/update (edge functions use service role)
CREATE POLICY "Service role can manage cache"
ON public.ai_response_cache FOR ALL
USING (true) WITH CHECK (true);
