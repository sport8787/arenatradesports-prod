CREATE TABLE IF NOT EXISTS public.mycroft_analyses_shadow_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  verdict text NOT NULL,
  plan_name text,
  market text,
  thesis text,
  odd numeric,
  confidence integer,
  risk_management jsonb,
  alerts jsonb,
  fundamentation jsonb,
  provider text NOT NULL DEFAULT 'gemini-ai',
  model text,
  approved_at_minute integer,
  approved_at_score_home integer,
  approved_at_score_away integer,
  stats_snapshot jsonb,
  latency_ms integer,
  raw_response jsonb,
  result text,
  final_score_home integer,
  final_score_away integer,
  settled_at timestamptz,
  settle_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shadow_ai_created ON public.mycroft_analyses_shadow_ai (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_ai_match ON public.mycroft_analyses_shadow_ai (match_id);
CREATE INDEX IF NOT EXISTS idx_shadow_ai_match_market ON public.mycroft_analyses_shadow_ai (match_id, market);
CREATE INDEX IF NOT EXISTS idx_shadow_ai_verdict ON public.mycroft_analyses_shadow_ai (verdict);
CREATE INDEX IF NOT EXISTS idx_shadow_ai_result ON public.mycroft_analyses_shadow_ai (result) WHERE result IS NOT NULL;

ALTER TABLE public.mycroft_analyses_shadow_ai ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read shadow ai" ON public.mycroft_analyses_shadow_ai;
CREATE POLICY "admins read shadow ai"
  ON public.mycroft_analyses_shadow_ai
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.settle_mycroft_shadow_ai(
  p_id uuid, p_score_home integer, p_score_away integer, p_reason text DEFAULT 'auto'
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market TEXT;
  v_verdict TEXT;
  v_total INT := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_appr_total INT;
  v_ah INT;
  v_aa INT;
  v_result TEXT;
  v_line NUMERIC;
BEGIN
  SELECT market, verdict, approved_at_score_home, approved_at_score_away
    INTO v_market, v_verdict, v_ah, v_aa
  FROM public.mycroft_analyses_shadow_ai WHERE id = p_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  IF v_market ~* '(pr[óo]ximo\s+gol|next\s+goal)' THEN
    IF v_ah IS NULL OR v_aa IS NULL THEN RETURN 'missing_snapshot'; END IF;
    v_appr_total := COALESCE(v_ah,0) + COALESCE(v_aa,0);
    v_result := CASE WHEN v_total > v_appr_total THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'over\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total > v_line THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* 'under\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'under\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total < v_line THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* '(btts|ambas\s+marcam|both\s+teams\s+to\s+score).*sim|^sim' THEN
    v_result := CASE WHEN p_score_home > 0 AND p_score_away > 0 THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* '(btts|ambas|both).*n[ãa]o' THEN
    v_result := CASE WHEN p_score_home = 0 OR p_score_away = 0 THEN 'green' ELSE 'red' END;
  ELSE
    RETURN 'unsupported_market';
  END IF;

  UPDATE public.mycroft_analyses_shadow_ai
  SET result = v_result,
      final_score_home = p_score_home,
      final_score_away = p_score_away,
      settled_at = now(),
      settle_reason = p_reason
  WHERE id = p_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_auto_settle_shadow_ai()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := lower(COALESCE(NEW.status, ''));
  v_old_status TEXT := lower(COALESCE(OLD.status, ''));
  v_finished_set TEXT[] := ARRAY['finished','ft','aet','pen','fin','ended'];
  v_minute INT := COALESCE(NEW.minute, 0);
  v_rec RECORD;
BEGIN
  IF NOT (v_status = ANY(v_finished_set)) THEN RETURN NEW; END IF;
  IF v_old_status = ANY(v_finished_set) THEN RETURN NEW; END IF;
  IF v_minute > 0 AND v_minute < 88 THEN RETURN NEW; END IF;

  FOR v_rec IN
    SELECT id FROM public.mycroft_analyses_shadow_ai
    WHERE match_id = NEW.match_id
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND result IS NULL
  LOOP
    PERFORM public.settle_mycroft_shadow_ai(
      v_rec.id, COALESCE(NEW.score_home,0), COALESCE(NEW.score_away,0),
      'auto_trigger_finished'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_auto_settle_shadow_ai erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_settle_shadow_ai ON public.live_matches;
CREATE TRIGGER auto_settle_shadow_ai
  AFTER UPDATE ON public.live_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_settle_shadow_ai();

INSERT INTO public.cron_settings (setting_key, is_enabled)
VALUES ('shadow_ai_cron', true)
ON CONFLICT (setting_key) DO NOTHING;