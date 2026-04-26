-- Tabela de configurações para Eventos Raros (compartilhada entre arenas)
CREATE TABLE IF NOT EXISTS public.eventos_raros_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena TEXT NOT NULL UNIQUE CHECK (arena IN ('punter', 'trader_sports', 'global')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  score_threshold INTEGER NOT NULL DEFAULT 60 CHECK (score_threshold BETWEEN 0 AND 100),
  betfair_mode TEXT NOT NULL DEFAULT 'simulado' CHECK (betfair_mode IN ('simulado', 'live')),
  notify_telegram BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.eventos_raros_config ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado pode ler config (UI das arenas precisa)
CREATE POLICY "Authenticated users can read eventos_raros_config"
ON public.eventos_raros_config FOR SELECT
TO authenticated
USING (true);

-- Escrita: somente admins (usa has_role já existente)
CREATE POLICY "Admins can insert eventos_raros_config"
ON public.eventos_raros_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update eventos_raros_config"
ON public.eventos_raros_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete eventos_raros_config"
ON public.eventos_raros_config FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_eventos_raros_config_updated
BEFORE UPDATE ON public.eventos_raros_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds iniciais (uma linha por arena + uma global)
INSERT INTO public.eventos_raros_config (arena, enabled, score_threshold, betfair_mode, notify_telegram)
VALUES
  ('global', true, 60, 'simulado', true),
  ('punter', true, 60, 'simulado', true),
  ('trader_sports', true, 60, 'simulado', true)
ON CONFLICT (arena) DO NOTHING;