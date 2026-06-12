-- Estatísticas agregadas das seleções Copa 2026
-- Fonte: API-Football (últimas 10 partidas oficiais por seleção)
-- Atualizada diariamente via cron fetch-national-team-stats

CREATE TABLE IF NOT EXISTS public.national_team_stats (
  id                    SERIAL PRIMARY KEY,
  team_name             TEXT NOT NULL,
  team_api_id           INTEGER,                      -- ID da API-Football (cache)
  last_matches_count    INT  DEFAULT 10,
  matches_analyzed      INT  DEFAULT 0,
  wins                  INT  DEFAULT 0,
  draws                 INT  DEFAULT 0,
  losses                INT  DEFAULT 0,
  goals_scored          INT  DEFAULT 0,
  goals_conceded        INT  DEFAULT 0,
  avg_goals_scored      DECIMAL(5,2),
  avg_goals_conceded    DECIMAL(5,2),
  avg_xg                DECIMAL(5,2),                -- xG médio (API-Football quando disponível, ou estimativa)
  avg_xga               DECIMAL(5,2),                -- xGA médio
  avg_possession        DECIMAL(5,2),                -- posse média (%)
  avg_shots_total       DECIMAL(5,2),
  avg_shots_on_target   DECIMAL(5,2),
  avg_corners           DECIMAL(5,2),
  btts_count            INT  DEFAULT 0,
  btts_percentage       DECIMAL(5,2),
  over_25_count         INT  DEFAULT 0,
  under_25_count        INT  DEFAULT 0,
  clean_sheet_count     INT  DEFAULT 0,
  failed_to_score_count INT  DEFAULT 0,
  last_updated          TIMESTAMPTZ DEFAULT now(),
  raw_data              JSONB,                        -- últimos jogos completos (debug)
  UNIQUE (team_name, last_matches_count)
);

CREATE INDEX IF NOT EXISTS idx_nts_team       ON public.national_team_stats (team_name);
CREATE INDEX IF NOT EXISTS idx_nts_updated    ON public.national_team_stats (last_updated);
CREATE INDEX IF NOT EXISTS idx_nts_api_id     ON public.national_team_stats (team_api_id);

-- RLS: leitura pública, escrita apenas service_role
ALTER TABLE public.national_team_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "national_team_stats_select"
  ON public.national_team_stats FOR SELECT USING (true);

CREATE POLICY "national_team_stats_service_write"
  ON public.national_team_stats FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
