
-- 1) Tornar plan validation aceitar 'starter'
CREATE OR REPLACE FUNCTION public.validate_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan NOT IN ('trial', 'starter', 'base', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', NEW.plan;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Colunas extras em user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS allowed_arenas TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_order_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_external_order
  ON public.user_subscriptions(external_order_id);

-- 3) Política para admin gerenciar
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
ON public.user_subscriptions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Tabela de auditoria de eventos da Kiwify e outros provedores
CREATE TABLE IF NOT EXISTS public.purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_order_id TEXT,
  customer_email TEXT,
  product_name TEXT,
  plan_resolved TEXT,
  amount NUMERIC,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  process_error TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_events_email ON public.purchase_events(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchase_events_order ON public.purchase_events(external_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_created ON public.purchase_events(created_at DESC);

ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read purchase events" ON public.purchase_events;
CREATE POLICY "Admins read purchase events"
ON public.purchase_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write purchase events" ON public.purchase_events;
CREATE POLICY "Admins write purchase events"
ON public.purchase_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) Ativar Lucineide (Starter, válido até 27/05/2026)
UPDATE public.user_subscriptions
SET plan = 'starter',
    is_active = true,
    subscription_started_at = '2026-04-28T00:00:00Z',
    subscription_ends_at = '2026-05-27T23:59:59Z',
    allowed_arenas = ARRAY['arena_live'],
    payment_provider = 'kiwify',
    notes = 'Ativação manual — compra Kiwify 28/04 com 50% OFF',
    updated_at = now()
WHERE user_id = '0f05674a-0683-4417-8128-8771df21d205';
