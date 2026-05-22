CREATE TABLE IF NOT EXISTS public.the_odds_api_quota (
  id INT PRIMARY KEY DEFAULT 1,
  remaining INT,
  used INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_alert_at TIMESTAMPTZ,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.the_odds_api_quota (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.the_odds_api_quota ENABLE ROW LEVEL SECURITY;