-- Fix: punter-settle-v3-15min e punter-settle-v3-daily-22h-brt tinham "jobid:59"
-- e "jobid:60" anexados ao final do comando SQL, causando erro de sintaxe em
-- CADA execução — a liquidação da Arena Punter nunca rodou.

-- 1. Recriar cron 15min com SQL correto
SELECT cron.unschedule('punter-settle-v3-15min');
SELECT cron.schedule(
  'punter-settle-v3-15min',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://ogpohiugfkvygcejrzfp.supabase.co/functions/v1/punter-settle-results-v3',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"}'::jsonb,
    body := jsonb_build_object('source','cron_15min','time', now())
  ) AS request_id$$
);

-- 2. Recriar cron diário 22h BRT com SQL correto
SELECT cron.unschedule('punter-settle-v3-daily-22h-brt');
SELECT cron.schedule(
  'punter-settle-v3-daily-22h-brt',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := 'https://ogpohiugfkvygcejrzfp.supabase.co/functions/v1/punter-settle-results-v3',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"}'::jsonb,
    body := jsonb_build_object('source','cron_daily_22h_brt','time', now())
  ) AS request_id$$
);

-- 3. Liquidar manualmente as 5 entradas presas (jogos da Série B não cobertos por
--    Futodds/Sportmonks, mas presentes em live_matches — cron estava quebrado).
--    Resultados verificados em live_matches:
--      Ceará 2-1 Avaí        | Goiás 0-4 Novorizontino | Sport Recife 1-1 Athletic Club

DO $$
DECLARE
  r RECORD;
  resultado_calc TEXT;
  profit NUMERIC;
  gh INT; ga INT;
BEGIN
  FOR r IN
    SELECT id, home_team, away_team, market, odd, stake_amount
    FROM punter_sinais
    WHERE id IN (
      '40249743-61fd-44f9-b1f8-b1e3acfa6f51', -- Ceará vs Avaí
      '795b892f-1b6c-48f7-b36a-cf8e7ca9871b', -- Goiás vs Novorizontino
      'ae71547a-240b-4b4f-bb01-8b8627c59095', -- Sport Recife vs Athletic Club
      'a2fc7713-e8dd-402a-9322-db1aff0c1460', -- Sport Recife vs Athletic Club
      '0ac27917-be53-4c75-bd63-6e05641fc7cf'  -- Sport Recife vs Athletic Club
    )
  LOOP
    -- Obter placar de live_matches
    SELECT
      lm.score_home::int, lm.score_away::int
    INTO gh, ga
    FROM live_matches lm
    WHERE lm.status IN ('finished','FT','ft','ended')
      AND (
        lower(lm.home_team) LIKE '%' || split_part(lower(r.home_team), ' ', 1) || '%'
        OR lower(r.home_team) LIKE '%' || split_part(lower(lm.home_team), ' ', 1) || '%'
      )
      AND (
        lower(lm.away_team) LIKE '%' || split_part(lower(r.away_team), ' ', 1) || '%'
        OR lower(r.away_team) LIKE '%' || split_part(lower(lm.away_team), ' ', 1) || '%'
      )
    LIMIT 1;

    IF gh IS NULL THEN
      CONTINUE; -- não encontrado, pula
    END IF;

    -- Calcular resultado
    resultado_calc := CASE
      WHEN lower(r.market) LIKE 'over%' THEN
        CASE
          WHEN (gh + ga) > CAST(regexp_replace(lower(r.market), '[^0-9.]', '', 'g') AS NUMERIC)
            THEN 'green'
          ELSE 'red'
        END
      WHEN lower(r.market) IN ('casa', '1') THEN
        CASE WHEN gh > ga THEN 'green' ELSE 'red' END
      WHEN lower(r.market) IN ('fora', '2') THEN
        CASE WHEN ga > gh THEN 'green' ELSE 'red' END
      WHEN lower(r.market) LIKE 'vitória do favorito%' OR lower(r.market) LIKE 'vitoria do favorito%' THEN
        -- Extrai nome do time entre parênteses e verifica se é casa ou fora
        CASE
          WHEN lower(r.market) LIKE '%(' || split_part(lower(r.home_team), ' ', 1) || '%'
            THEN CASE WHEN gh > ga THEN 'green' ELSE 'red' END
          ELSE
            CASE WHEN ga > gh THEN 'green' ELSE 'red' END
        END
      ELSE 'void'
    END;

    -- Calcular P&L
    profit := CASE resultado_calc
      WHEN 'green' THEN COALESCE(r.stake_amount, 1) * (COALESCE(r.odd, 2) - 1)
      WHEN 'red'   THEN -COALESCE(r.stake_amount, 1)
      ELSE 0
    END;

    UPDATE punter_sinais SET
      resultado        = resultado_calc,
      status           = 'settled',
      final_score_home = gh,
      final_score_away = ga,
      profit_loss      = ROUND(profit::NUMERIC, 2),
      resulted_at      = NOW(),
      settled_at       = NOW(),
      updated_at       = NOW(),
      fonte_liquidacao = 'live_matches'
    WHERE id = r.id;
  END LOOP;
END $$;
