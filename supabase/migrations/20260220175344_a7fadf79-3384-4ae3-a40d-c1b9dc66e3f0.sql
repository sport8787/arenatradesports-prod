
-- Add golden_tickets column to arena_poker_rankings for collectible achievements
ALTER TABLE public.arena_poker_rankings
  ADD COLUMN golden_tickets INTEGER NOT NULL DEFAULT 0;

-- Update record_arena_session to also increment golden_tickets on champion wins
CREATE OR REPLACE FUNCTION public.record_arena_session(
  p_user_id UUID,
  p_apc_earned INTEGER,
  p_scenarios_won INTEGER,
  p_scenarios_played INTEGER,
  p_is_champion BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.arena_poker_rankings (user_id, username, apc_balance, total_sessions, total_scenarios_won, total_scenarios_played, champion_titles, best_win_streak, golden_tickets)
  VALUES (
    p_user_id,
    COALESCE((SELECT username FROM public.profiles WHERE user_id = p_user_id), 'Jogador'),
    GREATEST(0, p_apc_earned),
    1,
    p_scenarios_won,
    p_scenarios_played,
    CASE WHEN p_is_champion THEN 1 ELSE 0 END,
    p_scenarios_won,
    CASE WHEN p_is_champion THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET apc_balance = GREATEST(0, arena_poker_rankings.apc_balance + p_apc_earned),
      total_sessions = arena_poker_rankings.total_sessions + 1,
      total_scenarios_won = arena_poker_rankings.total_scenarios_won + p_scenarios_won,
      total_scenarios_played = arena_poker_rankings.total_scenarios_played + p_scenarios_played,
      champion_titles = arena_poker_rankings.champion_titles + CASE WHEN p_is_champion THEN 1 ELSE 0 END,
      best_win_streak = GREATEST(arena_poker_rankings.best_win_streak, p_scenarios_won),
      golden_tickets = arena_poker_rankings.golden_tickets + CASE WHEN p_is_champion THEN 1 ELSE 0 END,
      updated_at = now();
END;
$$;
