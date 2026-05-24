-- ============================================================
-- Day Pass Upsell: Asaas Subscription R$ 47/mês + Lifecycle Log
-- ============================================================

-- 1) Adiciona coluna asaas_subscription_id em asaas_charges para
--    correlacionar cobranças recorrentes com a assinatura mãe.
ALTER TABLE public.asaas_charges
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_asaas_charges_subscription
  ON public.asaas_charges(asaas_subscription_id);

-- 2) Tabela day_pass_upsells: estado da assinatura recorrente por usuário.
CREATE TABLE IF NOT EXISTS public.day_pass_upsells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  asaas_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | overdue | cancelled
  first_charge_id TEXT,
  first_payment_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  next_due_date DATE,
  cancelled_at TIMESTAMPTZ,
  value NUMERIC(10,2) NOT NULL DEFAULT 47.00,
  trigger_source TEXT, -- green | 4h | 1h
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_day_pass_upsells_status ON public.day_pass_upsells(status);

ALTER TABLE public.day_pass_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own upsell"
ON public.day_pass_upsells FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all upsells"
ON public.day_pass_upsells FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_day_pass_upsells_updated_at
BEFORE UPDATE ON public.day_pass_upsells
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tabela day_pass_lifecycle_log: dedup de touches da sequência email/push.
CREATE TABLE IF NOT EXISTS public.day_pass_lifecycle_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  touch TEXT NOT NULL, -- D0_4H | D1 | D2 | D5 | D15
  channel TEXT NOT NULL, -- email | push
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent', -- sent | failed | skipped
  error_message TEXT,
  UNIQUE(user_id, touch, channel)
);

CREATE INDEX IF NOT EXISTS idx_day_pass_lifecycle_user ON public.day_pass_lifecycle_log(user_id);

ALTER TABLE public.day_pass_lifecycle_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view lifecycle log"
ON public.day_pass_lifecycle_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));