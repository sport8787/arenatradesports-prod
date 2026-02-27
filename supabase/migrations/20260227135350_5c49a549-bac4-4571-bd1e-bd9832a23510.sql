
-- Add score and red card columns to virtual_bets_punter
ALTER TABLE public.virtual_bets_punter
  ADD COLUMN IF NOT EXISTS score_home integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_away integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS red_card_home boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_card_away boolean DEFAULT false;

-- Add score and red card columns to punter_signals
ALTER TABLE public.punter_signals
  ADD COLUMN IF NOT EXISTS score_home integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_away integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS red_card_home boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_card_away boolean DEFAULT false;

-- Add score and red card columns to virtual_bets
ALTER TABLE public.virtual_bets
  ADD COLUMN IF NOT EXISTS score_home integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_away integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS red_card_home boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_card_away boolean DEFAULT false;
