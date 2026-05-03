CREATE OR REPLACE FUNCTION public.get_performance_punter(p_days integer DEFAULT NULL::integer)
 RETURNS TABLE(mercado text, greens bigint, reds bigint, win_rate_pct numeric, roi_pct numeric, total_sinais bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH unioned AS (
    -- 1) punter_sinais (mercado livre)
    SELECT
      COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado_label,
      LOWER(resultado) AS r,
      odd,
      profit_loss,
      stake_amount
    FROM public.punter_sinais
    WHERE LOWER(COALESCE(resultado, '')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR COALESCE(match_date, commence_time::date) >= (CURRENT_DATE - (p_days || ' days')::interval)::date)

    UNION ALL
    -- 2a) Plano Favorito — Vitória
    SELECT
      'Favorito — Vitória' AS mercado_label,
      LOWER(resultado_vitoria) AS r,
      fav_odd::numeric AS odd,
      NULL::numeric AS profit_loss,
      NULL::numeric AS stake_amount
    FROM public.sinais_favorito_prelive
    WHERE LOWER(COALESCE(resultado_vitoria,'')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR match_date >= now() - (p_days || ' days')::interval)

    UNION ALL
    -- 2b) Plano Favorito — Over 1.5
    SELECT
      'Favorito — Over 1.5' AS mercado_label,
      LOWER(resultado_over15) AS r,
      1.45::numeric AS odd,
      NULL::numeric, NULL::numeric
    FROM public.sinais_favorito_prelive
    WHERE LOWER(COALESCE(resultado_over15,'')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR match_date >= now() - (p_days || ' days')::interval)

    UNION ALL
    -- 2c) Plano Favorito — Over 2.5
    SELECT
      'Favorito — Over 2.5' AS mercado_label,
      LOWER(resultado_over25) AS r,
      1.85::numeric AS odd,
      NULL::numeric, NULL::numeric
    FROM public.sinais_favorito_prelive
    WHERE LOWER(COALESCE(resultado_over25,'')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR match_date >= now() - (p_days || ' days')::interval)

    UNION ALL
    -- 3) eventos_raros_sinais (LAY placar específico)
    SELECT
      'Eventos Raros — LAY ' || COALESCE(c.placar_alvo, 'placar') AS mercado_label,
      LOWER(s.resultado) AS r,
      s.odd_entrada AS odd,
      s.profit_loss,
      NULL::numeric AS stake_amount
    FROM public.eventos_raros_sinais s
    LEFT JOIN public.eventos_raros_candidatos c ON c.id = s.candidato_id
    WHERE LOWER(COALESCE(s.resultado,'')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR s.created_at >= now() - (p_days || ' days')::interval)
  ),
  base AS (
    SELECT
      LOWER(TRIM(mercado_label)) AS mercado_key,
      mercado_label,
      r,
      odd,
      profit_loss,
      stake_amount
    FROM unioned
  ),
  agg AS (
    SELECT
      mercado_key,
      (SELECT mercado_label
         FROM base b2
        WHERE b2.mercado_key = b.mercado_key
        GROUP BY mercado_label
        ORDER BY COUNT(*) DESC, mercado_label
        LIMIT 1) AS mercado,
      COUNT(*) FILTER (WHERE r = 'green') AS greens,
      COUNT(*) FILTER (WHERE r = 'red') AS reds,
      ROUND(
        COUNT(*) FILTER (WHERE r = 'green')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green','red')), 0) * 100, 1
      ) AS win_rate_pct,
      -- ROI híbrido: usa profit_loss/stake quando disponível;
      -- caso contrário, calcula em unidades (stake=1) com a odd.
      ROUND(
        (
          SUM(
            CASE
              WHEN stake_amount IS NOT NULL AND stake_amount > 0 AND profit_loss IS NOT NULL
                THEN profit_loss / stake_amount
              WHEN r = 'green' AND odd IS NOT NULL AND odd > 1
                THEN (odd - 1)
              WHEN r = 'red'
                THEN -1
              ELSE 0
            END
          )
        )::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green','red')), 0) * 100, 2
      ) AS roi_pct,
      COUNT(*) AS total_sinais
    FROM base b
    GROUP BY mercado_key
  )
  SELECT mercado, greens, reds, win_rate_pct, roi_pct, total_sinais
  FROM agg
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$function$;