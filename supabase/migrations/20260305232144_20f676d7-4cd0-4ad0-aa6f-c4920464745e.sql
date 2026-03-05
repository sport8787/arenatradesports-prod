-- Create separate bankroll for Arena Trader Sports
CREATE TABLE IF NOT EXISTS public.sports_bankroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(10,2) DEFAULT 10000.00,
  initial_balance numeric(10,2) DEFAULT 10000.00,
  total_staked numeric(10,2) DEFAULT 0,
  total_profit numeric(10,2) DEFAULT 0,
  total_bets integer DEFAULT 0,
  green_bets integer DEFAULT 0,
  red_bets integer DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.sports_bankroll ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own sports bankroll" ON public.sports_bankroll FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sports bankroll" ON public.sports_bankroll FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sports bankroll" ON public.sports_bankroll FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto-create sports bankroll for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_sports_bankroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.sports_bankroll (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_sports_bankroll
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_sports_bankroll();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_bankroll;

-- Remove the 2 Arena Trader Sports bets from virtual_bets and revert bankroll impact
-- The 2 bets were both GREEN with total profit of 756.25 (400 + 356.25) and stakes of 975 (500 + 475)
-- Revert: balance -= (profit_loss amounts), green_bets -= 2, total_bets -= 2
UPDATE public.user_bankroll
SET balance = balance - (500 * 1.80) - (475 * 1.75),
    total_profit = total_profit - 400.00 - 356.25,
    total_staked = total_staked - 500.00 - 475.00,
    total_bets = GREATEST(0, total_bets - 2),
    green_bets = GREATEST(0, green_bets - 2),
    win_rate = CASE WHEN GREATEST(0, green_bets - 2) + red_bets > 0 THEN ROUND(GREATEST(0, green_bets - 2)::numeric / (GREATEST(0, green_bets - 2) + red_bets) * 100, 2) ELSE 0 END,
    updated_at = now()
WHERE user_id = '0b6a62ef-e3b7-439a-bdfb-19cd9fce2b08';

-- Delete the 2 sports bets
DELETE FROM public.virtual_bets WHERE user_id = '0b6a62ef-e3b7-439a-bdfb-19cd9fce2b08';