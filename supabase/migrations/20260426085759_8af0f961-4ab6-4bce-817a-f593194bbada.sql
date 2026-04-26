CREATE TABLE public.sherlock_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  analysis_id UUID,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_id BIGINT,
  away_id BIGINT,
  season INT,
  market TEXT,
  plan_name TEXT,
  veto BOOLEAN NOT NULL DEFAULT false,
  veto_reason TEXT,
  confidence_delta INT NOT NULL DEFAULT 0,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  bonus JSONB NOT NULL DEFAULT '[]'::jsonb,
  vetos JSONB NOT NULL DEFAULT '[]'::jsonb,
  home_stats JSONB,
  away_stats JSONB,
  request_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sherlock_audit_user ON public.sherlock_audit_log(user_id, created_at DESC);
CREATE INDEX idx_sherlock_audit_analysis ON public.sherlock_audit_log(analysis_id);
CREATE INDEX idx_sherlock_audit_teams ON public.sherlock_audit_log(home_team, away_team, created_at DESC);

ALTER TABLE public.sherlock_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sherlock audit"
ON public.sherlock_audit_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own sherlock audit"
ON public.sherlock_audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access sherlock audit"
ON public.sherlock_audit_log FOR ALL
TO service_role
USING (true) WITH CHECK (true);