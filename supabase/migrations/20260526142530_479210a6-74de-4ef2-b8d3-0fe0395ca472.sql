
-- Tabela de vencimentos de chaves API (admin-only)
CREATE TABLE public.api_key_expirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  expires_at DATE NOT NULL,
  plan_label TEXT,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_key_expirations TO authenticated;
GRANT ALL ON public.api_key_expirations TO service_role;

ALTER TABLE public.api_key_expirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api key expirations"
  ON public.api_key_expirations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Log de notificações já enviadas (idempotência)
CREATE TABLE public.api_key_expiry_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name TEXT NOT NULL,
  expires_at DATE NOT NULL,
  days_left INTEGER NOT NULL,
  channel TEXT NOT NULL,
  user_id UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_name, expires_at, days_left, channel, user_id)
);

GRANT SELECT, INSERT ON public.api_key_expiry_notification_log TO authenticated;
GRANT ALL ON public.api_key_expiry_notification_log TO service_role;

ALTER TABLE public.api_key_expiry_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view api key expiry log"
  ON public.api_key_expiry_notification_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed inicial
INSERT INTO public.api_key_expirations (api_name, display_name, expires_at, plan_label, notes) VALUES
  ('futodds',       'Futodds',       '2026-06-17', 'Anual',   'Renovação anual contratada'),
  ('sportmonks',    'Sportmonks',    '2026-05-28', 'Trial',   'Trial 14d — rotacionar criando nova conta'),
  ('the_odds_api',  'The Odds API',  '2026-06-29', '20K/mês', 'Assinatura iniciada em 30/05/2026')
ON CONFLICT (api_name) DO NOTHING;

-- Trigger updated_at
CREATE TRIGGER update_api_key_expirations_updated_at
  BEFORE UPDATE ON public.api_key_expirations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
