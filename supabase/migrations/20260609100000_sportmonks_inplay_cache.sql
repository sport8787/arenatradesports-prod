-- Tabela de cache compartilhado para /livescores/inplay da Sportmonks.
-- Evita múltiplas edge functions (cron-live-matches Round1/Round2,
-- update-live-scores, sinais-alavanca-live etc.) baterem na mesma janela.
-- TTL é aplicacional: hot=75s (se teve ≥1 fixture), cold=180s (inplay vazio).

CREATE TABLE IF NOT EXISTS public.sportmonks_inplay_cache (
  cache_key   TEXT PRIMARY KEY DEFAULT 'global',
  payload     JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixture_count INTEGER NOT NULL DEFAULT 0,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sportmonks_inplay_cache ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode ler/escrever (edge functions usam service role key)
CREATE POLICY "service_role_only" ON public.sportmonks_inplay_cache
  USING (auth.role() = 'service_role');

-- Seed de linha inicial (evita MISS na primeira chamada)
INSERT INTO public.sportmonks_inplay_cache (cache_key, payload, fixture_count, fetched_at)
VALUES ('global', '[]'::jsonb, 0, '2000-01-01 00:00:00+00')
ON CONFLICT (cache_key) DO NOTHING;

COMMENT ON TABLE public.sportmonks_inplay_cache IS
  'Cache compartilhado do endpoint /football/livescores/inplay da Sportmonks. '
  'Populado pelas edge functions fetch-live-matches e update-live-scores. '
  'Reduz chamadas à API SM dentro da janela TTL (hot=75s / cold=180s).';
