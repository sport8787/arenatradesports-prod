
CREATE TABLE IF NOT EXISTS public.mycroft_analyses_shadow_af (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  plan_name TEXT,
  market TEXT,
  thesis TEXT,
  odd NUMERIC,
  confidence INTEGER,
  risk_management JSONB,
  alerts JSONB,
  fundamentation JSONB,
  provider TEXT NOT NULL DEFAULT 'api-football',
  approved_at_minute INTEGER,
  approved_at_score_home INTEGER,
  approved_at_score_away INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shadow_af_match ON public.mycroft_analyses_shadow_af(match_id);
CREATE INDEX IF NOT EXISTS idx_shadow_af_created ON public.mycroft_analyses_shadow_af(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_af_verdict ON public.mycroft_analyses_shadow_af(verdict);

ALTER TABLE public.mycroft_analyses_shadow_af ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read shadow af"
  ON public.mycroft_analyses_shadow_af
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
