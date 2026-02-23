-- Add unique constraint for upsert on scheduled_games
ALTER TABLE public.scheduled_games 
ADD CONSTRAINT scheduled_games_unique_match 
UNIQUE (match_date, match_time, home_team, away_team);