CREATE TABLE IF NOT EXISTS public.cron_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT,
  total_recebidos INT,
  total_filtrados INT,
  ligas_encontradas JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;