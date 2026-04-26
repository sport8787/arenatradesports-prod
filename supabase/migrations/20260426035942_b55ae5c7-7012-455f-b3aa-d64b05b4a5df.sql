
CREATE TABLE IF NOT EXISTS public.team_advanced_stats (
  team_id INT NOT NULL,
  season INT NOT NULL,
  team_name TEXT,
  home_avg_goals_scored NUMERIC(5,2) DEFAULT 0,
  home_avg_goals_conceded NUMERIC(5,2) DEFAULT 0,
  home_cv_scored NUMERIC(5,2) DEFAULT 0,
  home_cv_conceded NUMERIC(5,2) DEFAULT 0,
  away_avg_goals_scored NUMERIC(5,2) DEFAULT 0,
  away_avg_goals_conceded NUMERIC(5,2) DEFAULT 0,
  away_cv_scored NUMERIC(5,2) DEFAULT 0,
  away_cv_conceded NUMERIC(5,2) DEFAULT 0,
  home_avg_xg NUMERIC(5,2),
  away_avg_xg NUMERIC(5,2),
  sample_size INT DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, season)
);

ALTER TABLE public.team_advanced_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_advanced_stats readable by everyone"
ON public.team_advanced_stats FOR SELECT
USING (true);

CREATE POLICY "team_advanced_stats admin insert"
ON public.team_advanced_stats FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "team_advanced_stats admin update"
ON public.team_advanced_stats FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "team_advanced_stats admin delete"
ON public.team_advanced_stats FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_team_advanced_stats_updated
  ON public.team_advanced_stats (last_updated DESC);
