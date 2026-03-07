ALTER TABLE public.virtual_bets_manual 
  ADD COLUMN IF NOT EXISTS score_home integer,
  ADD COLUMN IF NOT EXISTS score_away integer,
  ADD COLUMN IF NOT EXISTS red_card_home boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_card_away boolean DEFAULT false;