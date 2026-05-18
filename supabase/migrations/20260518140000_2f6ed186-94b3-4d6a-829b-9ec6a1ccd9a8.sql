-- Add visibility column to user_trader_plans
ALTER TABLE public.user_trader_plans
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.user_trader_plans
  DROP CONSTRAINT IF EXISTS user_trader_plans_visibility_check;

ALTER TABLE public.user_trader_plans
  ADD CONSTRAINT user_trader_plans_visibility_check
  CHECK (visibility IN ('private', 'public'));

CREATE INDEX IF NOT EXISTS idx_user_trader_plans_visibility
  ON public.user_trader_plans (visibility)
  WHERE visibility = 'public';

-- Allow authenticated users to view public plans
DROP POLICY IF EXISTS "Anyone can view public plans" ON public.user_trader_plans;
CREATE POLICY "Anyone can view public plans"
  ON public.user_trader_plans
  FOR SELECT
  TO authenticated
  USING (visibility = 'public');