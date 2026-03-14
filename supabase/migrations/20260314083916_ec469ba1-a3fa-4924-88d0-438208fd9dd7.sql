CREATE TABLE IF NOT EXISTS public.mycroft_vetoed_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  jogo TEXT,
  liga TEXT,
  mercado TEXT,
  odd DECIMAL,
  edge_recebido DECIMAL,
  confianca_recebida DECIMAL,
  verdict_gemini TEXT,
  motivo_veto TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mycroft_vetoed_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert veto logs" ON public.mycroft_vetoed_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read veto logs" ON public.mycroft_vetoed_log
  FOR SELECT USING (true);