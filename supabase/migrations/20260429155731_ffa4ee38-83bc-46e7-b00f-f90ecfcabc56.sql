-- Tabela de histórico de alterações
CREATE TABLE IF NOT EXISTS public.mycroft_rules_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL CHECK (table_name IN ('mycroft_rules', 'mycroft_config')),
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  modo TEXT,
  changed_by UUID,
  changed_by_email TEXT,
  old_data JSONB,
  new_data JSONB,
  diff JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_history_record ON public.mycroft_rules_history(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rules_history_modo ON public.mycroft_rules_history(modo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rules_history_user ON public.mycroft_rules_history(changed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rules_history_created ON public.mycroft_rules_history(created_at DESC);

ALTER TABLE public.mycroft_rules_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rules history"
ON public.mycroft_rules_history FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert history"
ON public.mycroft_rules_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- Função genérica de captura
CREATE OR REPLACE FUNCTION public.tg_capture_rules_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_old JSONB;
  v_new JSONB;
  v_diff JSONB := '{}'::jsonb;
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_key TEXT;
  v_modo TEXT;
  v_record_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := OLD.id;
    v_modo := OLD.modo;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_modo := NEW.modo;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_modo := NEW.modo;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key NOT IN ('updated_at','created_at') AND v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.mycroft_rules_history
    (table_name, record_id, operation, modo, changed_by, changed_by_email, old_data, new_data, diff, changed_fields)
  VALUES
    (TG_TABLE_NAME, v_record_id, TG_OP, v_modo, v_user_id, v_email, v_old, v_new, v_diff, v_changed);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_capture_rules_history erro: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_mycroft_rules_history ON public.mycroft_rules;
CREATE TRIGGER trg_mycroft_rules_history
AFTER INSERT OR UPDATE OR DELETE ON public.mycroft_rules
FOR EACH ROW EXECUTE FUNCTION public.tg_capture_rules_history();

DROP TRIGGER IF EXISTS trg_mycroft_config_history ON public.mycroft_config;
CREATE TRIGGER trg_mycroft_config_history
AFTER INSERT OR UPDATE OR DELETE ON public.mycroft_config
FOR EACH ROW EXECUTE FUNCTION public.tg_capture_rules_history();