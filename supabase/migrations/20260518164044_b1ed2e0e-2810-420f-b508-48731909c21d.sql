
-- Cache de Predictions da Sportmonks (TTL aplicacional 6h)
CREATE TABLE IF NOT EXISTS public.sportmonks_predictions_cache (
  match_id text PRIMARY KEY,
  sm_fixture_id bigint,
  home_team text,
  away_team text,
  commence_time timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_pred_cache_fetched ON public.sportmonks_predictions_cache(fetched_at DESC);

ALTER TABLE public.sportmonks_predictions_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read predictions cache" ON public.sportmonks_predictions_cache;
CREATE POLICY "Authenticated read predictions cache"
  ON public.sportmonks_predictions_cache FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role write predictions cache" ON public.sportmonks_predictions_cache;
CREATE POLICY "Service role write predictions cache"
  ON public.sportmonks_predictions_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Shadow log para calibração futura (Mycroft vs Sportmonks)
CREATE TABLE IF NOT EXISTS public.punter_predictions_shadow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.punter_analyses(id) ON DELETE CASCADE,
  match_id text NOT NULL,
  home_team text,
  away_team text,
  league text,
  commence_time timestamptz,
  market text NOT NULL,
  mycroft_probability numeric,
  sportmonks_probability numeric,
  divergence_pp numeric,
  sherlock_alert boolean NOT NULL DEFAULT false,
  verdict text,
  was_green boolean,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pred_shadow_match ON public.punter_predictions_shadow(match_id);
CREATE INDEX IF NOT EXISTS idx_pred_shadow_alert ON public.punter_predictions_shadow(sherlock_alert, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pred_shadow_settled ON public.punter_predictions_shadow(was_green, settled_at DESC) WHERE was_green IS NOT NULL;

ALTER TABLE public.punter_predictions_shadow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read predictions shadow" ON public.punter_predictions_shadow;
CREATE POLICY "Authenticated read predictions shadow"
  ON public.punter_predictions_shadow FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role write predictions shadow" ON public.punter_predictions_shadow;
CREATE POLICY "Service role write predictions shadow"
  ON public.punter_predictions_shadow FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Campos diretos no punter_analyses para UI consumir sem join
ALTER TABLE public.punter_analyses
  ADD COLUMN IF NOT EXISTS sherlock_alert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sportmonks_probability numeric,
  ADD COLUMN IF NOT EXISTS sportmonks_divergence_pp numeric,
  ADD COLUMN IF NOT EXISTS sportmonks_prediction jsonb;

ALTER TABLE public.punter_sinais
  ADD COLUMN IF NOT EXISTS sherlock_alert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sportmonks_probability numeric,
  ADD COLUMN IF NOT EXISTS sportmonks_divergence_pp numeric;

-- Trigger: quando punter_analyses for liquidado (result preenchido), espelha resultado no shadow
CREATE OR REPLACE FUNCTION public.mirror_shadow_predictions_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.result IS DISTINCT FROM OLD.result AND NEW.result IS NOT NULL THEN
    UPDATE public.punter_predictions_shadow
    SET was_green = (UPPER(NEW.result) = 'GREEN'),
        settled_at = COALESCE(NEW.settled_at, now()),
        verdict = NEW.verdict
    WHERE analysis_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_shadow_predictions_result ON public.punter_analyses;
CREATE TRIGGER trg_mirror_shadow_predictions_result
  AFTER UPDATE ON public.punter_analyses
  FOR EACH ROW EXECUTE FUNCTION public.mirror_shadow_predictions_result();
