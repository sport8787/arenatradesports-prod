-- Tabela de tentativas de acesso negadas ao chat do Mycroft
CREATE TABLE public.mycroft_chat_access_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  plan TEXT,
  days_left INTEGER,
  source TEXT NOT NULL, -- 'analyst' | 'match' | 'sports' | 'other'
  reason TEXT NOT NULL, -- 'no_login' | 'free' | 'trial_expired' | 'plan_insufficient' | 'unknown'
  route TEXT,
  match_id TEXT,
  home_team TEXT,
  away_team TEXT,
  league TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mycroft_chat_attempts_created_at ON public.mycroft_chat_access_attempts (created_at DESC);
CREATE INDEX idx_mycroft_chat_attempts_user ON public.mycroft_chat_access_attempts (user_id);
CREATE INDEX idx_mycroft_chat_attempts_source ON public.mycroft_chat_access_attempts (source);
CREATE INDEX idx_mycroft_chat_attempts_reason ON public.mycroft_chat_access_attempts (reason);

ALTER TABLE public.mycroft_chat_access_attempts ENABLE ROW LEVEL SECURITY;

-- Só admin lê
CREATE POLICY "Admins can view chat access attempts"
ON public.mycroft_chat_access_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Inserts vão exclusivamente pela RPC SECURITY DEFINER (sem policy de INSERT pública)

-- RPC para registrar a tentativa (rate-limited 1/30s por user_id+source)
CREATE OR REPLACE FUNCTION public.log_mycroft_chat_attempt(
  p_source TEXT,
  p_reason TEXT,
  p_plan TEXT DEFAULT NULL,
  p_days_left INTEGER DEFAULT NULL,
  p_route TEXT DEFAULT NULL,
  p_match_id TEXT DEFAULT NULL,
  p_home_team TEXT DEFAULT NULL,
  p_away_team TEXT DEFAULT NULL,
  p_league TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_recent INT;
  v_id UUID;
BEGIN
  IF p_source NOT IN ('analyst','match','sports','other') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;
  IF p_reason NOT IN ('no_login','free','trial_expired','plan_insufficient','unknown') THEN
    RAISE EXCEPTION 'invalid reason: %', p_reason;
  END IF;

  -- Throttle: ignora se já existe registro nos últimos 30s para este usuário+source+match
  IF v_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent
    FROM public.mycroft_chat_access_attempts
    WHERE user_id = v_user_id
      AND source = p_source
      AND COALESCE(match_id,'') = COALESCE(p_match_id,'')
      AND created_at > now() - interval '30 seconds';
    IF v_recent > 0 THEN
      RETURN NULL;
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.mycroft_chat_access_attempts (
    user_id, email, plan, days_left, source, reason,
    route, match_id, home_team, away_team, league, user_agent, metadata
  ) VALUES (
    v_user_id, v_email, p_plan, p_days_left, p_source, p_reason,
    p_route, p_match_id, p_home_team, p_away_team, p_league, p_user_agent, COALESCE(p_metadata,'{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_mycroft_chat_attempt(
  TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated, anon;