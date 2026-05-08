CREATE OR REPLACE FUNCTION public.refresh_arena_calibration(p_arena TEXT, p_limit INT DEFAULT 50)
RETURNS TABLE(
  arena TEXT, sample_size INT, hit_rate NUMERIC, roi NUMERIC,
  effective_min_confidence INT, delta INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m RECORD;
  v_base INT;
  v_delta INT := 0;
  v_eff INT;
BEGIN
  SELECT * INTO m FROM public.compute_arena_calibration(p_arena, p_limit);

  SELECT s.base_min_confidence INTO v_base
  FROM public.arena_calibration_state s WHERE s.arena = p_arena;
  IF v_base IS NULL THEN v_base := 70; END IF;

  IF m.sample_size >= 20 THEN
    v_delta := CASE
      WHEN m.hit_rate < 0.50 THEN 10
      WHEN m.hit_rate < 0.60 THEN 5
      WHEN m.hit_rate < 0.70 THEN 0
      ELSE -3
    END;
  END IF;

  v_eff := GREATEST(60, LEAST(85, v_base + v_delta));

  INSERT INTO public.arena_calibration_state AS s
    (arena, sample_size, greens, reds, hit_rate, roi,
     base_min_confidence, delta, effective_min_confidence, last_settled_at, updated_at)
  VALUES (p_arena, m.sample_size, m.greens, m.reds, m.hit_rate, m.roi,
          v_base, v_delta, v_eff, m.last_settled_at, now())
  ON CONFLICT (arena) DO UPDATE SET
    sample_size = EXCLUDED.sample_size,
    greens = EXCLUDED.greens,
    reds = EXCLUDED.reds,
    hit_rate = EXCLUDED.hit_rate,
    roi = EXCLUDED.roi,
    delta = EXCLUDED.delta,
    effective_min_confidence = EXCLUDED.effective_min_confidence,
    last_settled_at = EXCLUDED.last_settled_at,
    updated_at = now();

  RETURN QUERY SELECT p_arena, m.sample_size, m.hit_rate, m.roi, v_eff, v_delta;
END;
$$;