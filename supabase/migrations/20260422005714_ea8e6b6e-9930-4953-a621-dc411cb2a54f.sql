
CREATE TABLE IF NOT EXISTS public.telegram_dedupe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  match_id TEXT,
  market TEXT,
  verdict TEXT,
  channel TEXT NOT NULL DEFAULT 'telegram',
  source TEXT,
  payload_hash TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_telegram_dedupe_match ON public.telegram_dedupe (match_id, market, verdict);
CREATE INDEX IF NOT EXISTS idx_telegram_dedupe_expires ON public.telegram_dedupe (expires_at);

ALTER TABLE public.telegram_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages telegram_dedupe"
ON public.telegram_dedupe
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
