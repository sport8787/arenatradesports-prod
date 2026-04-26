
-- Tabela de auditoria de violações de imutabilidade
CREATE TABLE IF NOT EXISTS public.approval_snapshot_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL,
  match_id TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT,
  attempted_value TEXT,
  reason TEXT NOT NULL DEFAULT 'immutable_field_modification',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_violations_created_at
  ON public.approval_snapshot_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_violations_analysis
  ON public.approval_snapshot_violations(analysis_id);

ALTER TABLE public.approval_snapshot_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read approval snapshot violations"
  ON public.approval_snapshot_violations;
CREATE POLICY "Admins can read approval snapshot violations"
  ON public.approval_snapshot_violations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role / triggers SECURITY DEFINER fazem INSERT direto;
-- nenhuma política de INSERT pública é necessária.

-- Atualiza o trigger de proteção: continua revertendo, mas registra a tentativa
CREATE OR REPLACE FUNCTION public.tg_protect_approval_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_violated BOOLEAN := FALSE;
BEGIN
  -- Só protege quando snapshot já existe (timestamp preenchido em OLD)
  IF OLD.approved_at_timestamp IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_at_minute IS DISTINCT FROM OLD.approved_at_minute THEN
    INSERT INTO public.approval_snapshot_violations
      (analysis_id, match_id, field_name, old_value, attempted_value, source)
    VALUES
      (OLD.id, OLD.match_id, 'approved_at_minute',
       OLD.approved_at_minute::text, NEW.approved_at_minute::text,
       current_setting('application_name', true));
    NEW.approved_at_minute := OLD.approved_at_minute;
    v_violated := TRUE;
  END IF;

  IF NEW.approved_at_score_home IS DISTINCT FROM OLD.approved_at_score_home THEN
    INSERT INTO public.approval_snapshot_violations
      (analysis_id, match_id, field_name, old_value, attempted_value, source)
    VALUES
      (OLD.id, OLD.match_id, 'approved_at_score_home',
       OLD.approved_at_score_home::text, NEW.approved_at_score_home::text,
       current_setting('application_name', true));
    NEW.approved_at_score_home := OLD.approved_at_score_home;
    v_violated := TRUE;
  END IF;

  IF NEW.approved_at_score_away IS DISTINCT FROM OLD.approved_at_score_away THEN
    INSERT INTO public.approval_snapshot_violations
      (analysis_id, match_id, field_name, old_value, attempted_value, source)
    VALUES
      (OLD.id, OLD.match_id, 'approved_at_score_away',
       OLD.approved_at_score_away::text, NEW.approved_at_score_away::text,
       current_setting('application_name', true));
    NEW.approved_at_score_away := OLD.approved_at_score_away;
    v_violated := TRUE;
  END IF;

  IF NEW.approved_at_timestamp IS DISTINCT FROM OLD.approved_at_timestamp THEN
    INSERT INTO public.approval_snapshot_violations
      (analysis_id, match_id, field_name, old_value, attempted_value, source)
    VALUES
      (OLD.id, OLD.match_id, 'approved_at_timestamp',
       OLD.approved_at_timestamp::text, NEW.approved_at_timestamp::text,
       current_setting('application_name', true));
    NEW.approved_at_timestamp := OLD.approved_at_timestamp;
    v_violated := TRUE;
  END IF;

  IF NEW.approved_at_period IS DISTINCT FROM OLD.approved_at_period THEN
    INSERT INTO public.approval_snapshot_violations
      (analysis_id, match_id, field_name, old_value, attempted_value, source)
    VALUES
      (OLD.id, OLD.match_id, 'approved_at_period',
       OLD.approved_at_period, NEW.approved_at_period,
       current_setting('application_name', true));
    NEW.approved_at_period := OLD.approved_at_period;
    v_violated := TRUE;
  END IF;

  IF v_violated THEN
    RAISE WARNING '[approval_snapshot] tentativa de alteração bloqueada para analysis_id=%', OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garante que o trigger BEFORE UPDATE existe
DROP TRIGGER IF EXISTS trg_protect_approval_snapshot ON public.mycroft_analyses;
CREATE TRIGGER trg_protect_approval_snapshot
  BEFORE UPDATE ON public.mycroft_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_approval_snapshot();
