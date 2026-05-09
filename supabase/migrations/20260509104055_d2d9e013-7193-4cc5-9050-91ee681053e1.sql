CREATE TABLE IF NOT EXISTS public.plano_favorito_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_source text NOT NULL DEFAULT 'manual',
  jogos_analisados int DEFAULT 0,
  sinais_fortes int DEFAULT 0,
  sinais_bons int DEFAULT 0,
  sinais_espelhados int DEFAULT 0,
  sinais_falha_mirror int DEFAULT 0,
  duracao_ms int,
  ok boolean DEFAULT true,
  error_message text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_runs_started_at ON public.plano_favorito_runs (started_at DESC);

ALTER TABLE public.plano_favorito_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read plano_favorito_runs"
  ON public.plano_favorito_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage plano_favorito_runs"
  ON public.plano_favorito_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);