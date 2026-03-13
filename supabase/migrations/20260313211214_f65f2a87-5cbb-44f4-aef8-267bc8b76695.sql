-- 1. Add odd_fonte and auto_cashout_min_value to virtual_bets
ALTER TABLE virtual_bets 
  ADD COLUMN IF NOT EXISTS odd_fonte text DEFAULT 'estimada',
  ADD COLUMN IF NOT EXISTS auto_cashout_min_value numeric DEFAULT null;

-- 2. Create cashout_signals_log table
CREATE TABLE IF NOT EXISTS public.cashout_signals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  match_id text NOT NULL,
  match_name text NOT NULL,
  market text NOT NULL,
  entry_odd numeric NOT NULL,
  current_odd numeric NOT NULL,
  cashout_value numeric NOT NULL,
  stake numeric NOT NULL,
  signal_type text NOT NULL DEFAULT 'CRITICAL',
  position_health text NOT NULL,
  mycroft_reason text,
  confidence integer,
  was_accepted boolean DEFAULT null,
  accepted_at timestamptz DEFAULT null,
  match_final_result text DEFAULT null,
  match_final_score text DEFAULT null,
  bet_would_have_won boolean DEFAULT null,
  potential_profit_loss numeric DEFAULT null,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cashout_signals_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
  ON public.cashout_signals_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert signals"
  ON public.cashout_signals_log FOR INSERT
  TO authenticated
  WITH CHECK (true);