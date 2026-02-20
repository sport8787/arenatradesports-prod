
-- Update record_arena_session to also credit BC balance via increment_bc_balance
CREATE OR REPLACE FUNCTION public.record_arena_session(p_user_id uuid, p_apc_earned integer, p_scenarios_won integer, p_scenarios_played integer, p_is_champion boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Shadow table: track APC internally for arena ranking
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

  -- Unified wallet: also credit BC balance on the user's profile
  IF p_apc_earned > 0 THEN
    UPDATE public.profiles
    SET bc_balance = bc_balance + p_apc_earned,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$function$;
