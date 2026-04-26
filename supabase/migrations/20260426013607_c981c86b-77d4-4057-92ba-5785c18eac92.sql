-- 1) Reforçar tg_capture_approval_snapshot com advisory lock por análise
CREATE OR REPLACE FUNCTION public.tg_capture_approval_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lm RECORD;
  v_existing RECORD;
  v_lock_key BIGINT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Só age para verdicts de aprovação
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL') THEN
    RETURN NEW;
  END IF;

  -- Imutabilidade direta: se já tem timestamp, preserva tudo
  IF NEW.approved_at_timestamp IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No UPDATE, se OLD já tinha snapshot, força preservação (defesa extra)
  IF TG_OP = 'UPDATE' AND OLD.approved_at_timestamp IS NOT NULL THEN
    NEW.approved_at_minute     := OLD.approved_at_minute;
    NEW.approved_at_score_home := OLD.approved_at_score_home;
    NEW.approved_at_score_away := OLD.approved_at_score_away;
    NEW.approved_at_timestamp  := OLD.approved_at_timestamp;
    NEW.approved_at_period     := OLD.approved_at_period;
    RETURN NEW;
  END IF;

  -- Advisory lock por id para serializar concorrência
  v_lock_key := hashtext('approval_snapshot_' || COALESCE(NEW.id::text, gen_random_uuid()::text));
  v_lock_acquired := pg_try_advisory_xact_lock(v_lock_key);

  IF v_lock_acquired AND NEW.id IS NOT NULL THEN
    -- Re-verifica no banco se outra transação concorrente já gravou o snapshot
    SELECT approved_at_minute, approved_at_score_home, approved_at_score_away,
           approved_at_timestamp, approved_at_period
    INTO v_existing
    FROM public.mycroft_analyses
    WHERE id = NEW.id
    FOR UPDATE;

    IF v_existing.approved_at_timestamp IS NOT NULL THEN
      NEW.approved_at_minute     := v_existing.approved_at_minute;
      NEW.approved_at_score_home := v_existing.approved_at_score_home;
      NEW.approved_at_score_away := v_existing.approved_at_score_away;
      NEW.approved_at_timestamp  := v_existing.approved_at_timestamp;
      NEW.approved_at_period     := v_existing.approved_at_period;
      RETURN NEW;
    END IF;
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
$function$;

-- 2) Trigger BEFORE UPDATE separado para BLOQUEAR alterações no snapshot já gravado
-- (qualquer tentativa de modificar campos approved_at_* após preenchidos é revertida)
CREATE OR REPLACE FUNCTION public.tg_protect_approval_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só protege se OLD já tinha snapshot finalizado
  IF OLD.approved_at_timestamp IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reverte qualquer mudança nos campos de snapshot
  IF NEW.approved_at_minute     IS DISTINCT FROM OLD.approved_at_minute
  OR NEW.approved_at_score_home IS DISTINCT FROM OLD.approved_at_score_home
  OR NEW.approved_at_score_away IS DISTINCT FROM OLD.approved_at_score_away
  OR NEW.approved_at_timestamp  IS DISTINCT FROM OLD.approved_at_timestamp
  OR NEW.approved_at_period     IS DISTINCT FROM OLD.approved_at_period THEN
    RAISE NOTICE '[approval_snapshot] Tentativa de sobrescrever snapshot imutável bloqueada (analysis_id=%)', OLD.id;
    NEW.approved_at_minute     := OLD.approved_at_minute;
    NEW.approved_at_score_home := OLD.approved_at_score_home;
    NEW.approved_at_score_away := OLD.approved_at_score_away;
    NEW.approved_at_timestamp  := OLD.approved_at_timestamp;
    NEW.approved_at_period     := OLD.approved_at_period;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_approval_snapshot ON public.mycroft_analyses;
CREATE TRIGGER trg_protect_approval_snapshot
BEFORE UPDATE ON public.mycroft_analyses
FOR EACH ROW
EXECUTE FUNCTION public.tg_protect_approval_snapshot();

-- 3) Índice parcial para acelerar verificação de snapshots já capturados
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_approved_snapshot
ON public.mycroft_analyses (id)
WHERE approved_at_timestamp IS NOT NULL;