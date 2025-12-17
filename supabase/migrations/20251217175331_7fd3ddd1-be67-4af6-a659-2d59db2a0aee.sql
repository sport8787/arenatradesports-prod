-- Create solo rankings table for Single Player mode
CREATE TABLE public.solo_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  total_games INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  successful_bluffs INTEGER NOT NULL DEFAULT 0,
  bluffs_detected INTEGER NOT NULL DEFAULT 0,
  times_fooled INTEGER NOT NULL DEFAULT 0,
  best_round INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solo_rankings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rankings (leaderboard is public)
CREATE POLICY "Solo rankings are viewable by everyone" 
ON public.solo_rankings 
FOR SELECT 
USING (true);

-- Allow users to insert their own ranking
CREATE POLICY "Users can insert their own solo ranking" 
ON public.solo_rankings 
FOR INSERT 
WITH CHECK (true);

-- Allow users to update their own ranking by session_id
CREATE POLICY "Users can update their own solo ranking" 
ON public.solo_rankings 
FOR UPDATE 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_solo_rankings_updated_at
BEFORE UPDATE ON public.solo_rankings
FOR EACH ROW
EXECUTE FUNCTION public.update_rankings_updated_at();