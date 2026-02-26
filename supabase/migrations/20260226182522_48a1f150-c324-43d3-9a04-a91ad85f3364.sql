
-- Blackjack Sessions
CREATE TABLE public.blackjack_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  casino TEXT NOT NULL DEFAULT 'Online',
  variant TEXT NOT NULL DEFAULT 'classic',
  decks INTEGER NOT NULL DEFAULT 6,
  initial_bankroll NUMERIC NOT NULL DEFAULT 500,
  current_bankroll NUMERIC NOT NULL DEFAULT 500,
  base_unit NUMERIC NOT NULL DEFAULT 5,
  increment NUMERIC NOT NULL DEFAULT 2,
  max_bet NUMERIC NOT NULL DEFAULT 50,
  stop_loss NUMERIC NOT NULL DEFAULT 100,
  stop_win NUMERIC NOT NULL DEFAULT 150,
  blackjack_payout NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  use_counting BOOLEAN NOT NULL DEFAULT true,
  hands_played INTEGER NOT NULL DEFAULT 0,
  hands_won INTEGER NOT NULL DEFAULT 0,
  hands_lost INTEGER NOT NULL DEFAULT 0,
  hands_pushed INTEGER NOT NULL DEFAULT 0,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  best_true_count NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blackjack_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blackjack sessions"
  ON public.blackjack_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blackjack sessions"
  ON public.blackjack_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blackjack sessions"
  ON public.blackjack_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Blackjack Hands
CREATE TABLE public.blackjack_hands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.blackjack_sessions(id) ON DELETE CASCADE,
  hand_number INTEGER NOT NULL DEFAULT 1,
  player_cards TEXT[] NOT NULL DEFAULT '{}',
  player_total INTEGER NOT NULL DEFAULT 0,
  player_soft BOOLEAN NOT NULL DEFAULT false,
  dealer_card TEXT NOT NULL DEFAULT '',
  running_count INTEGER NOT NULL DEFAULT 0,
  true_count NUMERIC NOT NULL DEFAULT 0,
  recommended_action TEXT,
  player_action TEXT,
  was_deviation BOOLEAN NOT NULL DEFAULT false,
  bet_amount NUMERIC NOT NULL DEFAULT 0,
  bet_units NUMERIC NOT NULL DEFAULT 1,
  result TEXT NOT NULL DEFAULT 'pending',
  profit_loss NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blackjack_hands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blackjack hands"
  ON public.blackjack_hands FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.blackjack_sessions s
    WHERE s.id = blackjack_hands.session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own blackjack hands"
  ON public.blackjack_hands FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.blackjack_sessions s
    WHERE s.id = blackjack_hands.session_id AND s.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_blackjack_sessions_updated_at
  BEFORE UPDATE ON public.blackjack_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
