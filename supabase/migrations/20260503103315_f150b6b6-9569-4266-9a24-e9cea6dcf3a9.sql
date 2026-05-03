-- Bucket público para servir HTML SEO gerado dinamicamente
INSERT INTO storage.buckets (id, name, public)
VALUES ('seo-static', 'seo-static', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permitir leitura pública
DROP POLICY IF EXISTS "Public read seo-static" ON storage.objects;
CREATE POLICY "Public read seo-static"
ON storage.objects FOR SELECT
USING (bucket_id = 'seo-static');

-- Permitir escrita pelo service role (edge function)
DROP POLICY IF EXISTS "Service role write seo-static" ON storage.objects;
CREATE POLICY "Service role write seo-static"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seo-static');

DROP POLICY IF EXISTS "Service role update seo-static" ON storage.objects;
CREATE POLICY "Service role update seo-static"
ON storage.objects FOR UPDATE
USING (bucket_id = 'seo-static');

-- Tabela para rastrear rodadas publicadas (auto-incrementa próxima rodada)
CREATE TABLE IF NOT EXISTS public.seo_rodadas_publicadas (
  id BIGSERIAL PRIMARY KEY,
  championship TEXT NOT NULL DEFAULT 'brasileirao-2026',
  rodada INT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  signals_count INT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(championship, rodada)
);

ALTER TABLE public.seo_rodadas_publicadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read seo rodadas" ON public.seo_rodadas_publicadas;
CREATE POLICY "Public read seo rodadas"
ON public.seo_rodadas_publicadas FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins manage seo rodadas" ON public.seo_rodadas_publicadas;
CREATE POLICY "Admins manage seo rodadas"
ON public.seo_rodadas_publicadas FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));