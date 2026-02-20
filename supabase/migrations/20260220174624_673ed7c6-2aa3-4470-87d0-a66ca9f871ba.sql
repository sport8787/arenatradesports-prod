
-- Arena Poker Rankings table with APC (Arena Poker Coins) currency
CREATE TABLE public.arena_poker_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL DEFAULT 'Jogador',
  apc_balance INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_scenarios_won INTEGER NOT NULL DEFAULT 0,
  total_scenarios_played INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  champion_titles INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT arena_poker_rankings_user_id_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.arena_poker_rankings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Arena rankings are publicly readable"
  ON public.arena_poker_rankings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own arena ranking"
  ON public.arena_poker_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own arena ranking"
  ON public.arena_poker_rankings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_arena_poker_rankings_updated_at
  BEFORE UPDATE ON public.arena_poker_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rankings_updated_at();

-- RPC to increment APC balance atomically
CREATE OR REPLACE FUNCTION public.increment_apc_balance(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.arena_poker_rankings (user_id, username, apc_balance)
  VALUES (
    p_user_id,
    COALESCE((SELECT username FROM public.profiles WHERE user_id = p_user_id), 'Jogador'),
    GREATEST(0, p_amount)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET apc_balance = GREATEST(0, arena_poker_rankings.apc_balance + p_amount),
      updated_at = now();
END;
$$;

-- RPC to record arena session results
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
  INSERT INTO public.arena_poker_rankings (user_id, username, apc_balance, total_sessions, total_scenarios_won, total_scenarios_played, champion_titles, best_win_streak)
  VALUES (
    p_user_id,
    COALESCE((SELECT username FROM public.profiles WHERE user_id = p_user_id), 'Jogador'),
    GREATEST(0, p_apc_earned),
    1,
    p_scenarios_won,
    p_scenarios_played,
    CASE WHEN p_is_champion THEN 1 ELSE 0 END,
    p_scenarios_won
  )
  ON CONFLICT (user_id) DO UPDATE
  SET apc_balance = GREATEST(0, arena_poker_rankings.apc_balance + p_apc_earned),
      total_sessions = arena_poker_rankings.total_sessions + 1,
      total_scenarios_won = arena_poker_rankings.total_scenarios_won + p_scenarios_won,
      total_scenarios_played = arena_poker_rankings.total_scenarios_played + p_scenarios_played,
      champion_titles = arena_poker_rankings.champion_titles + CASE WHEN p_is_champion THEN 1 ELSE 0 END,
      best_win_streak = GREATEST(arena_poker_rankings.best_win_streak, p_scenarios_won),
      updated_at = now();
END;
$$;
