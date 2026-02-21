
-- Arena Trader Rankings table (TraderCoin = atc internally, displayed as BC)
CREATE TABLE public.arena_trader_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT 'Jogador',
  atc_balance INTEGER NOT NULL DEFAULT 500000,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  best_trade_profit INTEGER NOT NULL DEFAULT 0,
  worst_trade_loss INTEGER NOT NULL DEFAULT 0,
  total_profit_loss INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arena_trader_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arena trader rankings are publicly readable"
  ON public.arena_trader_rankings FOR SELECT USING (true);

CREATE POLICY "Users can insert their own arena trader ranking"
  ON public.arena_trader_rankings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own arena trader ranking"
  ON public.arena_trader_rankings FOR UPDATE USING (auth.uid() = user_id);

-- RPC to update trader balance
CREATE OR REPLACE FUNCTION public.update_trader_balance(
  p_user_id UUID,
  p_amount INTEGER,
  p_is_win BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.arena_trader_rankings (user_id, username, atc_balance, total_trades, winning_trades, losing_trades, best_trade_profit, worst_trade_loss, total_profit_loss)
  VALUES (
    p_user_id,
    COALESCE((SELECT username FROM public.profiles WHERE user_id = p_user_id), 'Jogador'),
    GREATEST(0, 500000 + p_amount),
    1,
    CASE WHEN p_is_win THEN 1 ELSE 0 END,
    CASE WHEN p_is_win THEN 0 ELSE 1 END,
    CASE WHEN p_is_win THEN p_amount ELSE 0 END,
    CASE WHEN NOT p_is_win THEN p_amount ELSE 0 END,
    p_amount
  )
  ON CONFLICT (user_id) DO UPDATE
  SET atc_balance = GREATEST(0, arena_trader_rankings.atc_balance + p_amount),
      total_trades = arena_trader_rankings.total_trades + 1,
      winning_trades = arena_trader_rankings.winning_trades + CASE WHEN p_is_win THEN 1 ELSE 0 END,
      losing_trades = arena_trader_rankings.losing_trades + CASE WHEN NOT p_is_win THEN 1 ELSE 0 END,
      best_trade_profit = CASE WHEN p_is_win AND p_amount > arena_trader_rankings.best_trade_profit THEN p_amount ELSE arena_trader_rankings.best_trade_profit END,
      worst_trade_loss = CASE WHEN NOT p_is_win AND p_amount < arena_trader_rankings.worst_trade_loss THEN p_amount ELSE arena_trader_rankings.worst_trade_loss END,
      total_profit_loss = arena_trader_rankings.total_profit_loss + p_amount,
      updated_at = now();

  -- Unified wallet: also credit/debit BC balance on the user's profile
  UPDATE public.profiles
  SET bc_balance = GREATEST(0, bc_balance + p_amount),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- RPC to get or initialize trader balance
CREATE OR REPLACE FUNCTION public.get_trader_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT atc_balance INTO v_balance
  FROM public.arena_trader_rankings
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.arena_trader_rankings (user_id, username)
    VALUES (
      p_user_id,
      COALESCE((SELECT username FROM public.profiles WHERE user_id = p_user_id), 'Jogador')
    );
    RETURN 500000;
  END IF;

  RETURN v_balance;
END;
$$;
