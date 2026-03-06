
ALTER TABLE public.virtual_bets_punter 
ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES public.punter_analyses(id),
ADD COLUMN IF NOT EXISTS thesis text;
