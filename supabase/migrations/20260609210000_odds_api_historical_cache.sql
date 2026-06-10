-- ============================================================
-- Cache de odds históricas do The Odds API
-- Evita re-fetching na mesma data/esporte em backtests subsequentes
-- ============================================================

CREATE TABLE IF NOT EXISTS odds_api_historical_cache (
  cache_key      TEXT PRIMARY KEY,          -- '{sport_key}::{event_date}'
  sport_key      TEXT NOT NULL,             -- ex: 'soccer_epl'
  event_date     DATE NOT NULL,             -- data do evento (YYYY-MM-DD)
  events         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array de {home_team, away_team, odds: {...}}
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_api_cache_sport_date
  ON odds_api_historical_cache (sport_key, event_date);

-- RLS: service_role lê/escreve; anon só lê
ALTER TABLE odds_api_historical_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON odds_api_historical_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "anon_read" ON odds_api_historical_cache
  FOR SELECT USING (true);

COMMENT ON TABLE odds_api_historical_cache IS
  'Cache de snapshots de odds históricas do The Odds API. '
  'Indexado por sport_key + event_date para evitar chamadas repetidas nos backtests.';
