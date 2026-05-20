ALTER TABLE public.mycroft_analyses_shadow_ai
  ADD COLUMN IF NOT EXISTS home_team text,
  ADD COLUMN IF NOT EXISTS away_team text,
  ADD COLUMN IF NOT EXISTS championship text;