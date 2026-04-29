
CREATE TABLE IF NOT EXISTS public.live_match_stats_overrides (
  match_id text PRIMARY KEY,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lmso_updated_at ON public.live_match_stats_overrides(updated_at DESC);

ALTER TABLE public.live_match_stats_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view overrides"
  ON public.live_match_stats_overrides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert overrides"
  ON public.live_match_stats_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update overrides"
  ON public.live_match_stats_overrides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete overrides"
  ON public.live_match_stats_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lmso_updated_at
  BEFORE UPDATE ON public.live_match_stats_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
