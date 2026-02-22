
-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'trial',
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  subscription_started_at timestamp with time zone,
  subscription_ends_at timestamp with time zone,
  is_active boolean DEFAULT true,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add constraint via trigger instead of CHECK (for immutability safety)
CREATE OR REPLACE FUNCTION public.validate_subscription_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan NOT IN ('trial', 'base', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', NEW.plan;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_subscription_plan_trigger
BEFORE INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_plan();

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create trial on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, trial_started_at, trial_ends_at, is_active)
  VALUES (NEW.id, 'trial', now(), now() + interval '7 days', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();
