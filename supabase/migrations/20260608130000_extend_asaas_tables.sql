-- Migração: estende tabelas Asaas para suportar múltiplos planos e renovações

-- 1) asaas_charges: adiciona subscription_id e allowed_arenas
ALTER TABLE public.asaas_charges
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS allowed_arenas TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_charges_sub
  ON public.asaas_charges(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

-- 2) day_pass_upsells: adiciona plan_target para identificar o plano contratado
ALTER TABLE public.day_pass_upsells
  ADD COLUMN IF NOT EXISTS plan_target TEXT NOT NULL DEFAULT 'starter';

-- 3) user_subscriptions: adiciona payment_amount se não existir
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2) DEFAULT NULL;
