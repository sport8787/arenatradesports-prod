CREATE TABLE IF NOT EXISTS public.league_id_map (
  api_football_id INT PRIMARY KEY,
  sportmonks_id INT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_id_map_sm ON public.league_id_map(sportmonks_id);

ALTER TABLE public.league_id_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_id_map_read_all"
  ON public.league_id_map FOR SELECT
  USING (true);

CREATE POLICY "league_id_map_admin_write"
  ON public.league_id_map FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_league_id_map_updated_at
  BEFORE UPDATE ON public.league_id_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();