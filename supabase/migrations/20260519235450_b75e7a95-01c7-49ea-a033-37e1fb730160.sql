
-- Nova tabela: vários planos nomeados por usuário
CREATE TABLE IF NOT EXISTS public.user_trader_plans_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  market text NOT NULL,
  plan jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_trader_plans_v2_market_check CHECK (market = ANY (ARRAY['1x2','over_under','btts','corners'])),
  CONSTRAINT user_trader_plans_v2_visibility_check CHECK (visibility = ANY (ARRAY['private','public']))
);

CREATE INDEX IF NOT EXISTS idx_user_trader_plans_v2_user ON public.user_trader_plans_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trader_plans_v2_user_market ON public.user_trader_plans_v2(user_id, market);
CREATE INDEX IF NOT EXISTS idx_user_trader_plans_v2_public ON public.user_trader_plans_v2(visibility) WHERE visibility = 'public';

ALTER TABLE public.user_trader_plans_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own plans v2"
  ON public.user_trader_plans_v2
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all plans v2"
  ON public.user_trader_plans_v2
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "anyone can view public plans v2"
  ON public.user_trader_plans_v2
  FOR SELECT
  TO authenticated
  USING (visibility = 'public');

-- Trigger updated_at
CREATE TRIGGER update_user_trader_plans_v2_updated_at
  BEFORE UPDATE ON public.user_trader_plans_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Rastrear qual plano gerou o sinal
ALTER TABLE public.user_trader_plan_signals
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS plan_name text;

-- Migrar dados da tabela antiga (1 plano por mercado → 1 plano nomeado)
INSERT INTO public.user_trader_plans_v2 (user_id, name, market, plan, enabled, visibility, created_at, updated_at)
SELECT 
  user_id, 
  'Plano ' || upper(market) AS name,
  market,
  plan,
  COALESCE((plan->>'enabled')::boolean, false) AS enabled,
  visibility,
  updated_at,
  updated_at
FROM public.user_trader_plans
ON CONFLICT DO NOTHING;
