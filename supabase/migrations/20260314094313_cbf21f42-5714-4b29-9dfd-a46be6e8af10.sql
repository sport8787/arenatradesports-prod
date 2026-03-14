
-- Add columns to punter_signals for decoupled stake flow
ALTER TABLE public.punter_signals
  ADD COLUMN IF NOT EXISTS match_date DATE,
  ADD COLUMN IF NOT EXISTS stake_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stake_recalculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bankroll_at_recalc DECIMAL,
  ADD COLUMN IF NOT EXISTS stake_percentage_original DECIMAL,
  ADD COLUMN IF NOT EXISTS stake_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Index for daily recalculation cron
CREATE INDEX IF NOT EXISTS idx_punter_signals_match_date_status
  ON public.punter_signals(match_date, stake_confirmed, dismissed);

-- Add commence_time to punter_signals if not exists (needed for date extraction)
-- Already has match_id, we need the actual commence_time for date calculation
ALTER TABLE public.punter_signals
  ADD COLUMN IF NOT EXISTS commence_time TIMESTAMPTZ;
