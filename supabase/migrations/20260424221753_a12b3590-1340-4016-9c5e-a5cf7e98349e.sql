CREATE TABLE IF NOT EXISTS public.under_cashout_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  under_line NUMERIC NOT NULL CHECK (under_line IN (1.5, 2.5, 3.5, 4.5)),
  risk_profile TEXT NOT NULL DEFAULT 'moderado' CHECK (risk_profile IN ('conservador','moderado','agressivo','custom')),
  delta_dangerous_attacks INTEGER NOT NULL DEFAULT 4 CHECK (delta_dangerous_attacks >= 1 AND delta_dangerous_attacks <= 30),
  delta_shots_on_target INTEGER NOT NULL DEFAULT 3 CHECK (delta_shots_on_target >= 1 AND delta_shots_on_target <= 20),
  delta_xg NUMERIC NOT NULL DEFAULT 0.5 CHECK (delta_xg >= 0.1 AND delta_xg <= 3.0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, under_line)
);

CREATE INDEX IF NOT EXISTS idx_under_thresholds_user ON public.under_cashout_thresholds(user_id);

ALTER TABLE public.under_cashout_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own thresholds"
  ON public.under_cashout_thresholds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thresholds"
  ON public.under_cashout_thresholds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thresholds"
  ON public.under_cashout_thresholds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thresholds"
  ON public.under_cashout_thresholds FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_under_thresholds_updated_at
  BEFORE UPDATE ON public.under_cashout_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.under_cashout_thresholds IS 'Thresholds personalizados por usuário para gatilhos de cashout em mercados Under. Quando ausente, evaluate-cashout usa defaults (4/3/0.5 para Under 2.5).';