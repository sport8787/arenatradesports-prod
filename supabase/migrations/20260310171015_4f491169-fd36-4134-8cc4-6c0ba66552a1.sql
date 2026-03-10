
-- Audio inventory for Horus TTS pre-generation and caching
CREATE TYPE public.audio_frequency AS ENUM ('alta', 'media', 'baixa');

CREATE TABLE public.horus_audio_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  contexto TEXT[] NOT NULL DEFAULT '{}',
  frequencia audio_frequency NOT NULL DEFAULT 'media',
  cache_key TEXT UNIQUE,
  audio_url TEXT,
  is_generated BOOLEAN NOT NULL DEFAULT false,
  voice_id TEXT NOT NULL DEFAULT 'N2lVS1w4EtoT3dr4eOWO',
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by category and frequency
CREATE INDEX idx_horus_audio_categoria ON public.horus_audio_inventory(categoria);
CREATE INDEX idx_horus_audio_frequencia ON public.horus_audio_inventory(frequencia);
CREATE INDEX idx_horus_audio_cache_key ON public.horus_audio_inventory(cache_key);

-- Auto-update updated_at
CREATE TRIGGER update_horus_audio_updated_at
  BEFORE UPDATE ON public.horus_audio_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: public read, admin write
ALTER TABLE public.horus_audio_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audio inventory"
  ON public.horus_audio_inventory FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage audio inventory"
  ON public.horus_audio_inventory FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
