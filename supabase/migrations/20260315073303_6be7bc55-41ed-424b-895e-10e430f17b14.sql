CREATE TABLE IF NOT EXISTS public.poisson_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jogo TEXT,
  liga TEXT,
  lambda_casa DECIMAL,
  lambda_visitante DECIMAL,
  prob_casa DECIMAL,
  prob_empate DECIMAL,
  prob_visitante DECIMAL,
  prob_over25 DECIMAL,
  prob_btts DECIMAL,
  edges_positivos JSONB,
  dados_reais BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.poisson_log ENABLE ROW LEVEL SECURITY;