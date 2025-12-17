-- Add detective_score column to players table for tracking jury performance
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS detective_score integer NOT NULL DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN public.players.detective_score IS 'Tracks correct vote readings in current session for succession mechanic';