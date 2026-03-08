
ALTER TABLE public.virtual_bets 
  ADD COLUMN IF NOT EXISTS commence_time timestamp with time zone;

ALTER TABLE public.virtual_bets_punter 
  ADD COLUMN IF NOT EXISTS commence_time timestamp with time zone;

ALTER TABLE public.virtual_bets_manual 
  ADD COLUMN IF NOT EXISTS commence_time timestamp with time zone;
