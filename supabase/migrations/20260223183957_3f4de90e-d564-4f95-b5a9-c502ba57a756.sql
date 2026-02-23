
-- Função para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;

-- TABELA: Jogos programados do dia
CREATE TABLE IF NOT EXISTS public.scheduled_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  match_datetime TIMESTAMPTZ NOT NULL,
  league_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  event_id TEXT,
  match_id TEXT,
  status TEXT DEFAULT 'scheduled',
  check_time TIMESTAMPTZ NOT NULL,
  relevance_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_games_check_time ON scheduled_games(check_time, status);
CREATE INDEX idx_scheduled_games_date ON scheduled_games(match_date);
CREATE INDEX idx_scheduled_games_status ON scheduled_games(status);

CREATE TRIGGER update_scheduled_games_updated_at BEFORE UPDATE ON scheduled_games 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE VIEW next_games_to_check AS
SELECT * FROM scheduled_games
WHERE check_time <= NOW() + interval '15 minutes'
  AND status = 'scheduled'
ORDER BY check_time ASC;

ALTER TABLE public.scheduled_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled games"
ON public.scheduled_games FOR SELECT
USING (true);

COMMENT ON TABLE scheduled_games IS 'Jogos programados do dia buscados pelo TheSportsDB Schedule Day';
COMMENT ON COLUMN scheduled_games.check_time IS 'Horário para iniciar monitoramento (20 minutos antes do jogo)';
COMMENT ON COLUMN scheduled_games.relevance_score IS 'Score 0-10 baseado na importância da liga e times';
