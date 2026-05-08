CREATE TABLE IF NOT EXISTS public.trader_leagues (
  league_id integer PRIMARY KEY,
  name text NOT NULL,
  country text,
  region text NOT NULL DEFAULT 'OUTROS',
  tier text NOT NULL DEFAULT 'C',
  enabled boolean NOT NULL DEFAULT true,
  odds_sport_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trader_leagues_tier_check CHECK (tier IN ('A','B','C')),
  CONSTRAINT trader_leagues_region_check CHECK (region IN ('BRASIL','EUROPA','SUL_AMERICA','ASIA','NORTE_AMERICA','AFRICA','OCEANIA','MUNDO','OUTROS'))
);

CREATE INDEX IF NOT EXISTS idx_trader_leagues_enabled_tier ON public.trader_leagues (enabled, tier);
CREATE INDEX IF NOT EXISTS idx_trader_leagues_region ON public.trader_leagues (region);

ALTER TABLE public.trader_leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trader_leagues_select_all" ON public.trader_leagues;
CREATE POLICY "trader_leagues_select_all" ON public.trader_leagues FOR SELECT USING (true);

DROP POLICY IF EXISTS "trader_leagues_admin_write" ON public.trader_leagues;
CREATE POLICY "trader_leagues_admin_write" ON public.trader_leagues FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_trader_leagues_updated BEFORE UPDATE ON public.trader_leagues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();