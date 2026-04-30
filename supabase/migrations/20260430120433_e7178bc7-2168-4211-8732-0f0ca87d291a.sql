ALTER TABLE public.punter_sinais
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS fonte_liquidacao TEXT;