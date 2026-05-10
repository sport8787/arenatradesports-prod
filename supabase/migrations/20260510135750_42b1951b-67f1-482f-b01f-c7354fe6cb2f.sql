ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS chat_override_until timestamptz;

COMMENT ON COLUMN public.user_subscriptions.chat_override_until IS
  'Libera o Chat com Mycroft (geral + dentro de cards) até esta data, mesmo para planos não-premium. NULL = sem override.';