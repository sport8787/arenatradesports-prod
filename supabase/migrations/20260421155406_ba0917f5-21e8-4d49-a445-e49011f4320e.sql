ALTER TABLE public.punter_analyses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.punter_analyses;