CREATE TABLE IF NOT EXISTS public.prematch_context_cache (
  match_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prematch_context_cache ENABLE ROW LEVEL SECURITY;

-- Apenas service_role escreve; usuários autenticados podem ler para debug/UI
CREATE POLICY "prematch_ctx_read_auth" ON public.prematch_context_cache
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_prematch_ctx_fetched ON public.prematch_context_cache(fetched_at DESC);