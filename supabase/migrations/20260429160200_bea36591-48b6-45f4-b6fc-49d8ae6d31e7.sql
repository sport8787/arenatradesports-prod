CREATE TABLE IF NOT EXISTS public.mycroft_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modo TEXT NOT NULL UNIQUE CHECK (modo IN ('trader','punter')),
  divergence_threshold_pct NUMERIC NOT NULL DEFAULT 30,
  window_hours INTEGER NOT NULL DEFAULT 24,
  min_samples INTEGER NOT NULL DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.mycroft_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage alert thresholds"
ON public.mycroft_alert_thresholds FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.mycroft_alert_thresholds (modo, divergence_threshold_pct, window_hours, min_samples)
VALUES ('trader', 30, 24, 20), ('punter', 30, 24, 20)
ON CONFLICT (modo) DO NOTHING;