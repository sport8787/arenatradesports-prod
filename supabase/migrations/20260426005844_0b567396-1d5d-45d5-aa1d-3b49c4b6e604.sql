-- 1) Novas colunas (snapshot do momento da aprovação)
ALTER TABLE public.mycroft_analyses
  ADD COLUMN IF NOT EXISTS approved_at_minute      integer,
  ADD COLUMN IF NOT EXISTS approved_at_score_home  integer,
  ADD COLUMN IF NOT EXISTS approved_at_score_away  integer,
  ADD COLUMN IF NOT EXISTS approved_at_timestamp   timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at_period      text;

-- 2) Função: preenche snapshot apenas na 1ª vez que vira APROVADO/APROVADO_SITUACIONAL
CREATE OR REPLACE FUNCTION public.tg_capture_approval_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lm RECORD;
BEGIN
  -- Só age para verdicts de aprovação
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL') THEN
    RETURN NEW;
  END IF;

  -- Imutabilidade: se já tem timestamp de aprovação, nunca sobrescreve
  IF NEW.approved_at_timestamp IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No UPDATE, só captura se está virando aprovado agora (primeira vez)
  IF TG_OP = 'UPDATE'
     AND OLD.verdict IN ('APROVADO','APROVADO_SITUACIONAL')
     AND OLD.approved_at_timestamp IS NOT NULL THEN
    -- preserva snapshot original
    NEW.approved_at_minute     := OLD.approved_at_minute;
    NEW.approved_at_score_home := OLD.approved_at_score_home;
    NEW.approved_at_score_away := OLD.approved_at_score_away;
    NEW.approved_at_timestamp  := OLD.approved_at_timestamp;
    NEW.approved_at_period     := OLD.approved_at_period;
    RETURN NEW;
  END IF;

  -- Captura snapshot do live_matches correspondente
  SELECT minute, score_home, score_away, period
  INTO v_lm
  FROM public.live_matches
  WHERE match_id = NEW.match_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  NEW.approved_at_minute     := COALESCE(NEW.approved_at_minute,     v_lm.minute);
  NEW.approved_at_score_home := COALESCE(NEW.approved_at_score_home, v_lm.score_home, 0);
  NEW.approved_at_score_away := COALESCE(NEW.approved_at_score_away, v_lm.score_away, 0);
  NEW.approved_at_period     := COALESCE(NEW.approved_at_period,     v_lm.period);
  NEW.approved_at_timestamp  := COALESCE(NEW.approved_at_timestamp,  now());

  RETURN NEW;
END;
$$;

-- 3) Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_capture_approval_snapshot ON public.mycroft_analyses;
CREATE TRIGGER trg_capture_approval_snapshot
BEFORE INSERT OR UPDATE OF verdict
ON public.mycroft_analyses
FOR EACH ROW
EXECUTE FUNCTION public.tg_capture_approval_snapshot();

-- 4) Backfill: análises já aprovadas ganham snapshot a partir do live_matches atual
UPDATE public.mycroft_analyses ma
SET approved_at_minute     = COALESCE(ma.approved_at_minute,     lm.minute),
    approved_at_score_home = COALESCE(ma.approved_at_score_home, lm.score_home, 0),
    approved_at_score_away = COALESCE(ma.approved_at_score_away, lm.score_away, 0),
    approved_at_period     = COALESCE(ma.approved_at_period,     lm.period),
    approved_at_timestamp  = COALESCE(ma.approved_at_timestamp,  ma.created_at)
FROM public.live_matches lm
WHERE lm.match_id = ma.match_id
  AND ma.verdict IN ('APROVADO','APROVADO_SITUACIONAL')
  AND ma.approved_at_timestamp IS NULL;