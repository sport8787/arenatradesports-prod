
-- Fix security definer view
CREATE OR REPLACE VIEW next_games_to_check WITH (security_invoker = true) AS
SELECT * FROM scheduled_games
WHERE check_time <= NOW() + interval '15 minutes'
  AND status = 'scheduled'
ORDER BY check_time ASC;
