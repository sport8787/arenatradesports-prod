
-- ============================
-- A/B LAB: experimentos e decisões isoladas
-- ============================

CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hypothesis text,
  scope text NOT NULL DEFAULT 'punter', -- 'punter' | 'trader' | 'chats' | 'other'
  variant_a_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  variant_b_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft', -- draft|running|paused|promoted|discarded
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ab_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.ab_experiments(id) ON DELETE CASCADE,
  match_id text NOT NULL,
  market text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('A','B')),
  verdict text,            -- APROVADO | AGUARDAR | VETO | etc
  probability numeric,
  edge numeric,
  stake numeric,
  raw jsonb DEFAULT '{}'::jsonb,
  result text,             -- GREEN | RED | VOID | null
  pnl numeric,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ab_decisions_exp_variant_idx
  ON public.ab_decisions(experiment_id, variant);

CREATE UNIQUE INDEX IF NOT EXISTS ab_decisions_unique_idx
  ON public.ab_decisions(experiment_id, match_id, market, variant);

ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_decisions  ENABLE ROW LEVEL SECURITY;

-- Apenas admins
CREATE POLICY "ab_experiments admin all"
  ON public.ab_experiments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ab_decisions admin all"
  ON public.ab_decisions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.ab_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ab_experiments_touch ON public.ab_experiments;
CREATE TRIGGER ab_experiments_touch
  BEFORE UPDATE ON public.ab_experiments
  FOR EACH ROW
  EXECUTE FUNCTION public.ab_touch_updated_at();

-- =========================================
-- RPC de métricas comparativas A vs B
-- =========================================
CREATE OR REPLACE FUNCTION public.ab_compute_metrics(_experiment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  rec record;
  a_green int := 0; a_red int := 0; a_total int := 0;
  b_green int := 0; b_red int := 0; b_total int := 0;
  chi numeric := 0;
  pval numeric := NULL;
BEGIN
  FOR rec IN
    SELECT variant,
           COUNT(*) FILTER (WHERE verdict ILIKE 'APROVADO%') AS approved,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE result = 'GREEN') AS greens,
           COUNT(*) FILTER (WHERE result = 'RED')   AS reds,
           COUNT(*) FILTER (WHERE result IN ('GREEN','RED')) AS settled,
           COALESCE(SUM(pnl) FILTER (WHERE result IN ('GREEN','RED')),0) AS pnl_sum,
           COALESCE(SUM(stake) FILTER (WHERE result IN ('GREEN','RED')),0) AS stake_sum,
           COALESCE(AVG(stake),0) AS avg_stake,
           COALESCE(AVG(probability),0) AS avg_prob,
           COALESCE(AVG(edge),0) AS avg_edge
      FROM public.ab_decisions
     WHERE experiment_id = _experiment_id
     GROUP BY variant
  LOOP
    v := v || jsonb_build_object(rec.variant, jsonb_build_object(
      'total', rec.total,
      'approved', rec.approved,
      'greens', rec.greens,
      'reds', rec.reds,
      'settled', rec.settled,
      'green_pct', CASE WHEN rec.settled > 0 THEN ROUND((rec.greens::numeric / rec.settled)*100, 2) ELSE NULL END,
      'roi_pct',   CASE WHEN rec.stake_sum > 0 THEN ROUND((rec.pnl_sum / rec.stake_sum)*100, 2) ELSE NULL END,
      'avg_stake', ROUND(rec.avg_stake::numeric, 2),
      'avg_prob',  ROUND(rec.avg_prob::numeric, 2),
      'avg_edge',  ROUND(rec.avg_edge::numeric, 2)
    ));
    IF rec.variant = 'A' THEN
      a_green := rec.greens; a_red := rec.reds; a_total := rec.settled;
    ELSE
      b_green := rec.greens; b_red := rec.reds; b_total := rec.settled;
    END IF;
  END LOOP;

  -- Chi-quadrado 2x2 (GREEN/RED × A/B); aproximação rápida; p_value só direcional
  IF a_total > 0 AND b_total > 0 THEN
    DECLARE
      n numeric := a_total + b_total;
      row1 numeric := a_green + b_green;
      row2 numeric := a_red   + b_red;
      e_ag numeric; e_bg numeric; e_ar numeric; e_br numeric;
    BEGIN
      e_ag := row1 * a_total / n;
      e_bg := row1 * b_total / n;
      e_ar := row2 * a_total / n;
      e_br := row2 * b_total / n;
      IF e_ag > 0 AND e_bg > 0 AND e_ar > 0 AND e_br > 0 THEN
        chi := (POWER(a_green - e_ag, 2)/e_ag)
             + (POWER(b_green - e_bg, 2)/e_bg)
             + (POWER(a_red   - e_ar, 2)/e_ar)
             + (POWER(b_red   - e_br, 2)/e_br);
        -- aproximação simples p<0.05 se chi>3.84; p<0.01 se chi>6.63
        pval := CASE
          WHEN chi >= 6.63 THEN 0.01
          WHEN chi >= 3.84 THEN 0.05
          WHEN chi >= 2.71 THEN 0.10
          ELSE 0.5
        END;
      END IF;
    END;
  END IF;

  v := v || jsonb_build_object(
    'chi_square', ROUND(chi::numeric, 3),
    'p_value_approx', pval,
    'min_recommended_per_variant', 80
  );

  RETURN v;
END;
$$;

-- Lista divergências (mesmo jogo+mercado, veredito diferente entre A e B)
CREATE OR REPLACE FUNCTION public.ab_list_divergences(_experiment_id uuid)
RETURNS TABLE (
  match_id text,
  market text,
  a_verdict text, a_prob numeric, a_edge numeric, a_result text,
  b_verdict text, b_prob numeric, b_edge numeric, b_result text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.match_id,
         a.market,
         a.verdict, a.probability, a.edge, a.result,
         b.verdict, b.probability, b.edge, b.result
    FROM public.ab_decisions a
    JOIN public.ab_decisions b
      ON a.experiment_id = b.experiment_id
     AND a.match_id = b.match_id
     AND a.market   = b.market
     AND a.variant  = 'A'
     AND b.variant  = 'B'
   WHERE a.experiment_id = _experiment_id
     AND COALESCE(a.verdict,'') <> COALESCE(b.verdict,'')
   ORDER BY a.created_at DESC
   LIMIT 200;
$$;
