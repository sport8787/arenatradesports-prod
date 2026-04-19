CREATE TABLE public.landing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  whatsapp TEXT,
  source TEXT NOT NULL DEFAULT 'landing_hero',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT landing_leads_email_unique UNIQUE (email)
);

ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit a lead
CREATE POLICY "Anyone can insert leads"
ON public.landing_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read leads (no admin role assumed; keep restrictive by default)
CREATE POLICY "No public read"
ON public.landing_leads
FOR SELECT
TO authenticated
USING (false);

CREATE INDEX idx_landing_leads_created_at ON public.landing_leads(created_at DESC);