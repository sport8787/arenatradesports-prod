CREATE TABLE IF NOT EXISTS public.sinais_favorito_prelive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text NOT NULL UNIQUE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  league_id int,
  league_name text,
  match_date timestamptz,
  favorito text,
  fav_odd numeric,
  und_odd numeric,
  score_vitoria numeric,
  score_over15 numeric,
  score_over25 numeric,
  status_vitoria text CHECK (status_vitoria IN ('SINAL_FORTE','SINAL_BOM','CUIDADO','DESCARTADO')),
  status_over15 text CHECK (status_over15 IN ('SINAL_FORTE','SINAL_BOM','CUIDADO','DESCARTADO')),
  status_over25 text CHECK (status_over25 IN ('SINAL_FORTE','SINAL_BOM','CUIDADO','DESCARTADO')),
  indicadores jsonb,
  resultado_vitoria text CHECK (resultado_vitoria IN ('GREEN','RED','VOID')),
  resultado_over15 text CHECK (resultado_over15 IN ('GREEN','RED','VOID')),
  resultado_over25 text CHECK (resultado_over25 IN ('GREEN','RED','VOID')),
  gols_ht int,
  gols_ft int,
  fav_venceu boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fav_date ON public.sinais_favorito_prelive(match_date);
CREATE INDEX IF NOT EXISTS idx_fav_status ON public.sinais_favorito_prelive(status_over15, status_over25);
CREATE INDEX IF NOT EXISTS idx_fav_league ON public.sinais_favorito_prelive(league_id);

ALTER TABLE public.sinais_favorito_prelive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approved favorito signals"
  ON public.sinais_favorito_prelive FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_fav_updated_at
  BEFORE UPDATE ON public.sinais_favorito_prelive
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.v_roi_plano_favorito
WITH (security_invoker=on) AS
SELECT
  status_vitoria,
  status_over15,
  status_over25,
  count(*) FILTER (WHERE resultado_vitoria IS NOT NULL) AS total_vit,
  count(*) FILTER (WHERE resultado_vitoria = 'GREEN') AS greens_vit,
  round(
    count(*) FILTER (WHERE resultado_vitoria = 'GREEN')::numeric
    / nullif(count(*) FILTER (WHERE resultado_vitoria IN ('GREEN','RED')), 0) * 100, 1
  ) AS winrate_vit,
  count(*) FILTER (WHERE resultado_over15 IS NOT NULL) AS total_o15,
  count(*) FILTER (WHERE resultado_over15 = 'GREEN') AS greens_o15,
  round(
    count(*) FILTER (WHERE resultado_over15 = 'GREEN')::numeric
    / nullif(count(*) FILTER (WHERE resultado_over15 IN ('GREEN','RED')), 0) * 100, 1
  ) AS winrate_o15,
  count(*) FILTER (WHERE resultado_over25 IS NOT NULL) AS total_o25,
  count(*) FILTER (WHERE resultado_over25 = 'GREEN') AS greens_o25,
  round(
    count(*) FILTER (WHERE resultado_over25 = 'GREEN')::numeric
    / nullif(count(*) FILTER (WHERE resultado_over25 IN ('GREEN','RED')), 0) * 100, 1
  ) AS winrate_o25
FROM public.sinais_favorito_prelive
GROUP BY status_vitoria, status_over15, status_over25;