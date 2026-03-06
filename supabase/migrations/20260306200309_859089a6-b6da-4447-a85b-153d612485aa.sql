
-- Create manual_bankroll table (for user's own decisions)
-- Mirrors user_bankroll structure
CREATE TABLE IF NOT EXISTS public.manual_bankroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric DEFAULT 10000.00,
  initial_balance numeric DEFAULT 10000.00,
  total_staked numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  total_bets integer DEFAULT 0,
  green_bets integer DEFAULT 0,
  red_bets integer DEFAULT 0,
  win_rate numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_bankroll ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own manual bankroll" ON public.manual_bankroll
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manual bankroll" ON public.manual_bankroll
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual bankroll" ON public.manual_bankroll
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto-create manual_bankroll for new users (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user_manual_bankroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.manual_bankroll (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_manual_bankroll
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_manual_bankroll();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_bankroll;

-- Create virtual_bets_manual table for manual bets tracking
CREATE TABLE IF NOT EXISTS public.virtual_bets_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id text NOT NULL,
  match_name text,
  market text NOT NULL,
  odd numeric NOT NULL,
  stake numeric NOT NULL,
  status text DEFAULT 'pending',
  result text,
  profit_loss numeric,
  thesis text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.virtual_bets_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual bets" ON public.virtual_bets_manual
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manual bets" ON public.virtual_bets_manual
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual bets" ON public.virtual_bets_manual
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
