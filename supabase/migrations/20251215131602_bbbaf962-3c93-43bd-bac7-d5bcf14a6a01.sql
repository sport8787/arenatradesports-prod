-- Create rankings table for persistent player stats
CREATE TABLE public.rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  total_games INT NOT NULL DEFAULT 0,
  total_wins INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  successful_bluffs INT NOT NULL DEFAULT 0,
  bluffs_detected INT NOT NULL DEFAULT 0,
  times_fooled INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Rankings are publicly readable"
ON public.rankings FOR SELECT
USING (true);

CREATE POLICY "Anyone can create ranking"
ON public.rankings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update their ranking"
ON public.rankings FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_rankings_session_id ON public.rankings(session_id);
CREATE INDEX idx_rankings_total_points ON public.rankings(total_points DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rankings_updated_at
BEFORE UPDATE ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION public.update_rankings_updated_at();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rankings;