-- ============ user_trader_plans ============
CREATE TABLE public.user_trader_plans (
  user_id uuid NOT NULL,
  market text NOT NULL CHECK (market IN ('1x2','over_under','btts','corners')),
  plan jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, market)
);

ALTER TABLE public.user_trader_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own plans" ON public.user_trader_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all plans" ON public.user_trader_plans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ user_trader_plan_signals ============
CREATE TABLE public.user_trader_plan_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id text NOT NULL,
  match_name text,
  league text,
  market text NOT NULL,
  outcome text NOT NULL,
  line numeric,
  market_label text NOT NULL,
  selected_odd numeric,
  minute integer,
  reasons jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','green','red')),
  profit_loss numeric DEFAULT 0,
  commence_time timestamptz,
  placed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (user_id, match_id, market, outcome)
);

CREATE INDEX user_trader_plan_signals_user_idx ON public.user_trader_plan_signals(user_id);
CREATE INDEX user_trader_plan_signals_status_idx ON public.user_trader_plan_signals(status);
CREATE INDEX user_trader_plan_signals_market_idx ON public.user_trader_plan_signals(market);
CREATE INDEX user_trader_plan_signals_placed_idx ON public.user_trader_plan_signals(placed_at DESC);

ALTER TABLE public.user_trader_plan_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own plan signals" ON public.user_trader_plan_signals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all plan signals" ON public.user_trader_plan_signals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ Mirror trigger: liquida sinais pessoais junto com virtual_bets ============
CREATE OR REPLACE FUNCTION public.mirror_virtual_bet_to_user_plan_signals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('green','red') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.user_trader_plan_signals s
    SET status = NEW.status,
        settled_at = COALESCE(NEW.settled_at, now()),
        profit_loss = CASE
          WHEN NEW.status = 'green' THEN ROUND((COALESCE(s.selected_odd, NEW.odd) - 1)::numeric * 100, 2)
          ELSE -100
        END
    WHERE s.match_id = NEW.match_id
      AND s.status = 'pending'
      AND (
        upper(NEW.market) LIKE '%' || upper(s.market_label) || '%'
        OR upper(s.market_label) LIKE '%' || upper(NEW.market) || '%'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_vb_to_user_plan_signals ON public.virtual_bets;
CREATE TRIGGER trg_mirror_vb_to_user_plan_signals
AFTER UPDATE OF status ON public.virtual_bets
FOR EACH ROW
EXECUTE FUNCTION public.mirror_virtual_bet_to_user_plan_signals();