
-- Sinais Alavanca: Under 4.5 (juros compostos)
CREATE TABLE IF NOT EXISTS public.sinais_alavanca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  match_name text NOT NULL,
  league text,
  league_id integer,
  kickoff timestamptz,
  mode text NOT NULL CHECK (mode IN ('live','prelive')),
  score numeric NOT NULL DEFAULT 0,
  odd_under45 numeric,
  minute integer,
  goals_total integer,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','green','red','void')),
  settled_result jsonb,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sinais_alavanca_match_mode_uq
  ON public.sinais_alavanca (match_id, mode);
CREATE INDEX IF NOT EXISTS sinais_alavanca_status_idx
  ON public.sinais_alavanca (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sinais_alavanca_kickoff_idx
  ON public.sinais_alavanca (kickoff);

ALTER TABLE public.sinais_alavanca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sinais alavanca"
  ON public.sinais_alavanca FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages sinais alavanca"
  ON public.sinais_alavanca FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER sinais_alavanca_updated_at
  BEFORE UPDATE ON public.sinais_alavanca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-settlement quando o jogo finalizar (FT no live_matches)
CREATE OR REPLACE FUNCTION public.trg_settle_sinais_alavanca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_goals integer;
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    total_goals := COALESCE(NEW.score_home,0) + COALESCE(NEW.score_away,0);
    UPDATE public.sinais_alavanca
       SET status = CASE WHEN total_goals <= 4 THEN 'green' ELSE 'red' END,
           settled_result = jsonb_build_object('score_home', NEW.score_home, 'score_away', NEW.score_away, 'total', total_goals),
           settled_at = now()
     WHERE match_id = NEW.match_id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settle_sinais_alavanca ON public.live_matches;
CREATE TRIGGER trg_settle_sinais_alavanca
  AFTER UPDATE OF status ON public.live_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_settle_sinais_alavanca();
