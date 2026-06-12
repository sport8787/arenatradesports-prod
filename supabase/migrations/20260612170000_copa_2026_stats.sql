-- copa_2026_stats: base de conhecimento curada pelo trader
-- Prioridade sobre national_team_stats no chat Mycroft
-- Pode ser populada via FBref, Understat ou qualquer fonte rica
-- Source: 'manual' | 'fbref' | 'understat' | 'api-football'

CREATE TABLE IF NOT EXISTS public.copa_2026_stats (
  team_name          TEXT PRIMARY KEY,
  last_matches       INT  DEFAULT 10,
  avg_goals_scored   DECIMAL(5,2),
  avg_goals_conceded DECIMAL(5,2),
  avg_xg             DECIMAL(5,2),
  avg_xga            DECIMAL(5,2),
  avg_possession     DECIMAL(5,2),
  over_25_pct        DECIMAL(5,2),
  btts_pct           DECIMAL(5,2),
  clean_sheet_pct    DECIMAL(5,2),
  avg_corners        DECIMAL(5,2),
  avg_shots_on_target DECIMAL(5,2),
  form_last5         TEXT,            -- "WDWWL" (mais recente à esquerda)
  matches_data       JSONB,           -- array de partidas individuais
  source             TEXT DEFAULT 'manual',
  notes              TEXT,
  last_updated       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.copa_2026_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copa_2026_stats_read"
  ON public.copa_2026_stats FOR SELECT USING (true);

CREATE POLICY "copa_2026_stats_write"
  ON public.copa_2026_stats FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_copa_2026_stats_team ON public.copa_2026_stats (team_name);

-- Popula automaticamente a partir do national_team_stats existente
-- (como ponto de partida — pode ser sobrescrito com dados do FBref)
INSERT INTO public.copa_2026_stats (
  team_name, last_matches,
  avg_goals_scored, avg_goals_conceded,
  avg_xg, avg_xga,
  avg_possession,
  over_25_pct, btts_pct, clean_sheet_pct,
  avg_corners, avg_shots_on_target,
  matches_data, source, last_updated
)
SELECT
  team_name,
  last_matches_count,
  avg_goals_scored,
  avg_goals_conceded,
  avg_xg,
  avg_xga,
  avg_possession,
  CASE WHEN matches_analyzed > 0
    THEN ROUND((over_25_count::DECIMAL / matches_analyzed) * 100, 1) END,
  btts_percentage,
  CASE WHEN matches_analyzed > 0
    THEN ROUND((clean_sheet_count::DECIMAL / matches_analyzed) * 100, 1) END,
  avg_corners,
  avg_shots_on_target,
  raw_data,
  'api-football',
  last_updated
FROM public.national_team_stats
WHERE last_matches_count = 10
ON CONFLICT (team_name) DO NOTHING;
