
-- 1) Permitir plano 'preview' (lead capturado, ainda sem pagamento)
CREATE OR REPLACE FUNCTION public.validate_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan NOT IN ('preview', 'trial', 'starter', 'basic', 'base', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', NEW.plan;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Cobranças Asaas (1 por cobrança gerada)
CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_charge_id TEXT UNIQUE,
  asaas_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  billing_type TEXT NOT NULL DEFAULT 'PIX',
  value NUMERIC(10,2) NOT NULL,
  description TEXT,
  invoice_url TEXT,
  pix_qr_code TEXT,
  pix_payload TEXT,
  pix_expires_at TIMESTAMPTZ,
  product_slug TEXT NOT NULL DEFAULT 'day_pass',
  plan_target TEXT NOT NULL DEFAULT 'premium',
  duration_hours INT NOT NULL DEFAULT 24,
  paid_at TIMESTAMPTZ,
  raw_create_response JSONB,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_charges_user ON public.asaas_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_asaas_charges_status ON public.asaas_charges(status);

ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own charges"
ON public.asaas_charges FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all charges"
ON public.asaas_charges FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Eventos do webhook Asaas (auditoria + idempotência)
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  asaas_charge_id TEXT,
  user_id UUID,
  processed BOOLEAN NOT NULL DEFAULT false,
  process_error TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_charge ON public.asaas_webhook_events(asaas_charge_id);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
ON public.asaas_webhook_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Trigger updated_at em asaas_charges
CREATE TRIGGER trg_asaas_charges_updated_at
BEFORE UPDATE ON public.asaas_charges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
