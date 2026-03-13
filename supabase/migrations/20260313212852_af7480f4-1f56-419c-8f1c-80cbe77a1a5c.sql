-- Add missing columns to cashout_signals_log for deterministic estimation debug
ALTER TABLE public.cashout_signals_log 
  ADD COLUMN IF NOT EXISTS odd_fonte text DEFAULT 'estimada',
  ADD COLUMN IF NOT EXISTS modo text DEFAULT 'simulado',
  ADD COLUMN IF NOT EXISTS fatores jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS minuto integer,
  ADD COLUMN IF NOT EXISTS placar text;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_bet_id ON public.cashout_signals_log(bet_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_id ON public.cashout_signals_log(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.cashout_signals_log(created_at DESC);

-- Create accuracy view for Mycroft calibration
CREATE OR REPLACE VIEW public.mycroft_cashout_accuracy AS
SELECT
  user_id,
  modo,
  COUNT(*) AS total_signals,
  SUM(CASE WHEN was_accepted = TRUE AND bet_would_have_won = FALSE THEN 1 ELSE 0 END) AS correct_exits,
  SUM(CASE WHEN was_accepted = TRUE AND bet_would_have_won = TRUE THEN 1 ELSE 0 END) AS wrong_exits,
  SUM(CASE WHEN was_accepted = FALSE AND bet_would_have_won = TRUE THEN 1 ELSE 0 END) AS correct_holds,
  ROUND(
    SUM(CASE WHEN was_accepted = TRUE AND bet_would_have_won = FALSE THEN 1 ELSE 0 END)::DECIMAL /
    NULLIF(SUM(CASE WHEN was_accepted IS NOT NULL AND bet_would_have_won IS NOT NULL THEN 1 ELSE 0 END), 0) * 100, 1
  ) AS accuracy_pct
FROM public.cashout_signals_log
WHERE bet_would_have_won IS NOT NULL
GROUP BY user_id, modo;