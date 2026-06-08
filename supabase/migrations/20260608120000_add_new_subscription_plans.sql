-- Migração: adicionar planos Iniciante, Profissional e Elite
-- Plano Promo (starter, R$47,90) acumula BC mas não pode resgatar prêmios.
-- Plano Iniciante (R$87,90) — 1 arena à escolha.
-- Plano Profissional (R$147,00) — 2 arenas + Arena Trader + Ciclos.
-- Plano Elite (R$249,90) — tudo + Chat AO VIVO + 1.3× multiplicador BC.

-- 1) Ampliar função de validação do plano
CREATE OR REPLACE FUNCTION public.validate_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan NOT IN (
    'trial', 'starter', 'basic', 'base', 'premium',
    'iniciante', 'profissional', 'elite'
  ) THEN
    RAISE EXCEPTION 'Invalid plan: %', NEW.plan;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Adicionar coluna bc_multiplier à user_subscriptions (se ainda não existir)
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS bc_multiplier numeric(4,2) NOT NULL DEFAULT 1.0;

-- 3) Garantir bc_multiplier = 1.3 para plano elite existentes (e futuros via trigger)
CREATE OR REPLACE FUNCTION public.set_bc_multiplier_by_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan = 'elite' THEN
    NEW.bc_multiplier := 1.3;
  ELSE
    NEW.bc_multiplier := 1.0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_bc_multiplier ON public.user_subscriptions;
CREATE TRIGGER trg_set_bc_multiplier
  BEFORE INSERT OR UPDATE OF plan ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_bc_multiplier_by_plan();

-- 4) Atualizar registros existentes
UPDATE public.user_subscriptions SET bc_multiplier = 1.3 WHERE plan = 'elite';
UPDATE public.user_subscriptions SET bc_multiplier = 1.0 WHERE plan <> 'elite';
