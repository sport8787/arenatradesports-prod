
-- Promo codes table
CREATE TABLE public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Track which user used which promo/referral
CREATE TABLE public.promo_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  promo_code_id UUID REFERENCES public.promo_codes(id),
  referral_source TEXT,
  partner_name TEXT NOT NULL,
  trial_days_granted INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Anyone can read promo codes (to validate)
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

-- Users can see their own redemptions
CREATE POLICY "Users see own redemptions"
  ON public.promo_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Insert SPIN30 promo code for SpinAtaque
INSERT INTO public.promo_codes (code, partner_name, trial_days, is_active)
VALUES ('SPIN30', 'SpinAtaque', 30, true);
