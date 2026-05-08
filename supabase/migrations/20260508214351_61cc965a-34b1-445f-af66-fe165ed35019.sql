-- Frente 3 (Calibração por Bucket) + Frente 1 parte 2 (Quarentena via CLV/ROI)

-- 1) Helpers
CREATE OR REPLACE FUNCTION public.punter_market_family(market_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN market_text IS NULL THEN 'OTHER'
    WHEN market_text ILIKE '%asian%handicap%' OR market_text ~* '(^|[^a-z])AH([^a-z]|$)'
      OR market_text ILIKE '%handicap%asi%' OR market_text ILIKE '%handicap asiatico%'
      OR market_text ~* '(^|[^a-z])handicap([^a-z]|$)' THEN 'AH'
    WHEN market_text ILIKE '%over%' OR market_text ILIKE '%under%' OR market_text ILIKE '%mais de%' OR market_text ILIKE '%menos de%' THEN 'OU'
    WHEN market_text ILIKE '%btts%' OR market_text ILIKE '%both teams%' OR market_text ILIKE '%ambas%marca%' THEN 'BTTS'
    WHEN market_text ILIKE '%moneyline%' OR market_text ILIKE '%match winner%' OR market_text ILIKE '%1x2%' OR market_text ILIKE '%vencedor%' THEN 'ML'
    WHEN market_text ILIKE '%corner%' OR market_text ILIKE '%escanteio%' THEN 'CR'
    ELSE 'OTHER'
  END
$$;

CREATE OR REPLACE FUNCTION public.punter_odd_bucket(odd numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN odd IS NULL THEN 'unknown'
    WHEN odd < 1.50 THEN '<1.50'
    WHEN odd < 1.80 THEN '1.50-1.80'
    WHEN odd < 2.20 THEN '1.80-2.20'
    WHEN odd < 2.80 THEN '2.20-2.80'
    ELSE '>=2.80'
  END
$$;

-- 2) Tabelas
CREATE TABLE IF NOT EXISTS public.punter_bucket_calibration (
  bucket_key text PRIMARY KEY,
  market_family text NOT NULL,
  odd_bucket text NOT NULL,
  sample_size int NOT NULL DEFAULT 0,
  hit_rate numeric NOT NULL DEFAULT 0,
  expected_hit_rate numeric NOT NULL DEFAULT 0,
  accuracy_gap_pp numeric NOT NULL DEFAULT 0,
  roi numeric NOT NULL DEFAULT 0,
  brier_score numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.punter_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL UNIQUE,
  league text,
  market_family text NOT NULL,
  odd_bucket text NOT NULL,
  reason text NOT NULL,
  metric_value numeric,
  sample_size int,
  active_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS punter_quarantine_active_idx
  ON public.punter_quarantine(scope_key, active_until);

-- 3) Recompute buckets (90 dias)
CREATE OR REPLACE FUNCTION public.recompute_punter_buckets()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  WITH src AS (
    SELECT punter_market_family(market) AS fam,
           punter_odd_bucket(odd) AS ob,
           result, odd, profit_loss,
           coalesce(stake_amount, stake_percentage::numeric) AS stake_amount
    FROM punter_signals
    WHERE settled_at > now() - interval '90 days'
      AND result IN ('GREEN','RED')
  ), agg AS (
    SELECT fam, ob,
      count(*) AS sample_size,
      avg(CASE WHEN result='GREEN' THEN 1.0 ELSE 0.0 END) AS hit_rate,
      avg(1.0/NULLIF(odd,0)) AS expected_hit_rate,
      coalesce(sum(profit_loss),0)/NULLIF(sum(stake_amount),0)*100 AS roi,
      avg(power((CASE WHEN result='GREEN' THEN 1.0 ELSE 0.0 END) - (1.0/NULLIF(odd,0)), 2)) AS brier_score
    FROM src
    WHERE fam <> 'OTHER'
    GROUP BY fam, ob
  )
  INSERT INTO punter_bucket_calibration
    (bucket_key, market_family, odd_bucket, sample_size, hit_rate, expected_hit_rate, accuracy_gap_pp, roi, brier_score, updated_at)
  SELECT fam||'__'||ob, fam, ob, sample_size, hit_rate, expected_hit_rate,
         (hit_rate - expected_hit_rate)*100, coalesce(roi,0), brier_score, now()
  FROM agg
  ON CONFLICT (bucket_key) DO UPDATE SET
    sample_size = EXCLUDED.sample_size,
    hit_rate = EXCLUDED.hit_rate,
    expected_hit_rate = EXCLUDED.expected_hit_rate,
    accuracy_gap_pp = EXCLUDED.accuracy_gap_pp,
    roi = EXCLUDED.roi,
    brier_score = EXCLUDED.brier_score,
    updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 4) Refresh quarentena (ROI < -5% por liga x bucket OU CLV<-1.5pp por bucket)
CREATE OR REPLACE FUNCTION public.refresh_punter_quarantine()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int := 0;
BEGIN
  DELETE FROM punter_quarantine WHERE active_until <= now();

  INSERT INTO punter_quarantine (scope_key, league, market_family, odd_bucket, reason, metric_value, sample_size, active_until)
  SELECT
    coalesce(league,'_all_')||'|'||punter_market_family(market)||'|'||punter_odd_bucket(odd),
    league,
    punter_market_family(market),
    punter_odd_bucket(odd),
    'ROI<-5% em 30d (n>=15)',
    coalesce(sum(profit_loss),0)/NULLIF(sum(coalesce(stake_amount, stake_percentage::numeric)),0)*100,
    count(*),
    now() + interval '14 days'
  FROM punter_signals
  WHERE settled_at > now() - interval '30 days'
    AND result IN ('GREEN','RED')
    AND punter_market_family(market) IN ('AH','OU','ML','BTTS')
  GROUP BY league, punter_market_family(market), punter_odd_bucket(odd)
  HAVING count(*) >= 15
     AND coalesce(sum(profit_loss),0)/NULLIF(sum(coalesce(stake_amount, stake_percentage::numeric)),0)*100 < -5
  ON CONFLICT (scope_key) DO UPDATE SET
    reason = EXCLUDED.reason, metric_value = EXCLUDED.metric_value,
    sample_size = EXCLUDED.sample_size, active_until = EXCLUDED.active_until;

  INSERT INTO punter_quarantine (scope_key, league, market_family, odd_bucket, reason, metric_value, sample_size, active_until)
  SELECT
    '_all_|'||punter_market_family(c.market)||'|'||punter_odd_bucket(s.odd),
    NULL,
    punter_market_family(c.market),
    punter_odd_bucket(s.odd),
    'CLV<-1.5pp em 30d (n>=15)',
    avg(c.clv_pp),
    count(*),
    now() + interval '14 days'
  FROM punter_clv_log c
  JOIN punter_signals s ON s.match_id = c.match_id AND s.market = c.market
  WHERE c.created_at > now() - interval '30 days'
    AND c.clv_pp IS NOT NULL
    AND punter_market_family(c.market) IN ('AH','OU','ML','BTTS')
  GROUP BY punter_market_family(c.market), punter_odd_bucket(s.odd)
  HAVING count(*) >= 15 AND avg(c.clv_pp) < -1.5
  ON CONFLICT (scope_key) DO UPDATE SET
    reason = EXCLUDED.reason, metric_value = EXCLUDED.metric_value,
    sample_size = EXCLUDED.sample_size, active_until = EXCLUDED.active_until;

  SELECT count(*) INTO n FROM punter_quarantine WHERE active_until > now();
  RETURN n;
END $$;

-- 5) RPC consumida pelo engine: retorna quarentena + ajuste por bucket pra um sinal
CREATE OR REPLACE FUNCTION public.punter_check_signal_quality(
  _league text, _market text, _odd numeric
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  fam text := punter_market_family(_market);
  ob text := punter_odd_bucket(_odd);
  q_row record;
  b_row record;
  conf_delta int := 0;
  in_quarantine boolean := false;
  reasons text[] := ARRAY[]::text[];
BEGIN
  -- 1) Quarentena por liga ou global
  SELECT * INTO q_row FROM punter_quarantine
  WHERE active_until > now()
    AND market_family = fam
    AND odd_bucket = ob
    AND (league = _league OR league IS NULL)
  ORDER BY (league = _league) DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    in_quarantine := true;
    reasons := array_append(reasons, 'QUARENTENA: '||q_row.reason||' ('||q_row.scope_key||')');
  END IF;

  -- 2) Bucket calibration (precisa >=30 amostras pra aplicar)
  SELECT * INTO b_row FROM punter_bucket_calibration
  WHERE market_family = fam AND odd_bucket = ob;
  IF FOUND AND b_row.sample_size >= 30 THEN
    IF b_row.accuracy_gap_pp < -8 THEN
      conf_delta := conf_delta - 10;
      reasons := array_append(reasons, format('Bucket %s underperforming (%.1fpp gap, n=%s)', b_row.bucket_key, b_row.accuracy_gap_pp, b_row.sample_size));
    ELSIF b_row.accuracy_gap_pp > 8 THEN
      conf_delta := conf_delta + 3;
    END IF;
    IF b_row.roi < -8 THEN
      conf_delta := conf_delta - 5;
      reasons := array_append(reasons, format('Bucket ROI %s%% em 90d', round(b_row.roi,1)));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'in_quarantine', in_quarantine,
    'confidence_delta', conf_delta,
    'market_family', fam,
    'odd_bucket', ob,
    'reasons', to_jsonb(reasons),
    'bucket_sample_size', coalesce(b_row.sample_size,0),
    'bucket_accuracy_gap_pp', coalesce(b_row.accuracy_gap_pp,0),
    'bucket_roi', coalesce(b_row.roi,0)
  );
END $$;

-- 6) RLS
ALTER TABLE public.punter_bucket_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punter_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read bucket calibration" ON public.punter_bucket_calibration;
CREATE POLICY "admin read bucket calibration" ON public.punter_bucket_calibration
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read quarantine" ON public.punter_quarantine;
CREATE POLICY "admin read quarantine" ON public.punter_quarantine
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- 7) Permite RPC pública (sem PII; só leitura calculada)
GRANT EXECUTE ON FUNCTION public.punter_check_signal_quality(text,text,numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_punter_buckets() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_punter_quarantine() TO service_role;