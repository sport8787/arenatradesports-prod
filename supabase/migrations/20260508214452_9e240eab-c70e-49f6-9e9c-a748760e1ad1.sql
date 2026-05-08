CREATE OR REPLACE FUNCTION public.recompute_punter_buckets()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  WITH src AS (
    SELECT punter_market_family(s.market) AS fam,
           punter_odd_bucket(s.odd) AS ob,
           s.result, s.odd, s.profit_loss,
           coalesce(s.stake_amount, s.stake_percentage::numeric) AS stake_amount
    FROM punter_signals s
    WHERE s.resulted_at > now() - interval '90 days'
      AND s.result IN ('GREEN','RED')
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

CREATE OR REPLACE FUNCTION public.refresh_punter_quarantine()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int := 0;
BEGIN
  DELETE FROM punter_quarantine WHERE active_until <= now();

  INSERT INTO punter_quarantine (scope_key, league, market_family, odd_bucket, reason, metric_value, sample_size, active_until)
  SELECT
    coalesce(a.league,'_all_')||'|'||punter_market_family(s.market)||'|'||punter_odd_bucket(s.odd),
    a.league,
    punter_market_family(s.market),
    punter_odd_bucket(s.odd),
    'ROI<-5% em 30d (n>=15)',
    coalesce(sum(s.profit_loss),0)/NULLIF(sum(coalesce(s.stake_amount, s.stake_percentage::numeric)),0)*100,
    count(*),
    now() + interval '14 days'
  FROM punter_signals s
  LEFT JOIN punter_analyses a ON a.id = s.analysis_id
  WHERE s.resulted_at > now() - interval '30 days'
    AND s.result IN ('GREEN','RED')
    AND punter_market_family(s.market) IN ('AH','OU','ML','BTTS')
  GROUP BY a.league, punter_market_family(s.market), punter_odd_bucket(s.odd)
  HAVING count(*) >= 15
     AND coalesce(sum(s.profit_loss),0)/NULLIF(sum(coalesce(s.stake_amount, s.stake_percentage::numeric)),0)*100 < -5
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