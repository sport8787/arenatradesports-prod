ALTER TABLE public.virtual_bets_punter ADD COLUMN IF NOT EXISTS asset_score integer;
ALTER TABLE public.virtual_bets_manual ADD COLUMN IF NOT EXISTS asset_score integer;