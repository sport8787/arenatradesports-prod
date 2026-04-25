
-- Catálogo de áudios do Hórus para Arena Punter
CREATE TABLE public.audios_horus_punter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  audio_url TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audios_horus_punter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audios"
ON public.audios_horus_punter FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_audios_horus_punter_updated_at
BEFORE UPDATE ON public.audios_horus_punter
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registro de execuções por usuário (garante one-time)
CREATE TABLE public.horus_punter_audio_plays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_chave TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, audio_chave)
);

ALTER TABLE public.horus_punter_audio_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plays"
ON public.horus_punter_audio_plays FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own plays"
ON public.horus_punter_audio_plays FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_horus_plays_user ON public.horus_punter_audio_plays(user_id);

-- Seed dos dois áudios
INSERT INTO public.audios_horus_punter (chave, titulo, descricao, audio_url, ordem) VALUES
('apresentacao_horus', 'Apresentação do Hórus', 'Reproduzido na primeira visita à página /menu', '/audio/horus/apresentacao_horus.mp3', 1),
('sinais_aprovados', 'Sinais Aprovados', 'Reproduzido na primeira vez que o usuário clica no card Sinais Aprovados', '/audio/horus/sinais_aprovados.mp3', 2);
