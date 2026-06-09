-- ============================================================
-- 1) pg_cron: Handicap Asiático — rodada noturna (17h BRT / 20h UTC)
-- 2) Calibração Mycroft Punter — valores calibrados 2026-06-09
-- ============================================================

-- ─── HA EVENING CRON ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'punter-prelive-ah-evening') THEN
    PERFORM cron.unschedule('punter-prelive-ah-evening');
  END IF;
END $$;

-- 20:00 UTC = 17:00 BRT — jogos noturnos europeus e brasileiros
SELECT cron.schedule(
  'punter-prelive-ah-evening',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ogpohiugfkvygcejrzfp.supabase.co/functions/v1/handicap-asiatico-prelive',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"}'::jsonb,
    body    := '{"source":"cron","run_id":"evening"}'::jsonb
  );
  $$
);

-- ─── PUNTER CALIBRATION ROW ──────────────────────────────────
-- Desativa qualquer linha ativa anterior
UPDATE punter_calibration SET is_active = false WHERE is_active = true;

-- Insere linha calibrada 2026-06-09
INSERT INTO punter_calibration (
  is_active,
  min_probability, min_edge, min_confidence,
  odd_min, odd_max, tolerance_pp,
  tier1_min_edge, tier1_min_conf, tier1_max_stake, tier1_min_prob,
  tier2_min_edge, tier2_min_conf, tier2_max_stake, tier2_min_prob,
  tier3_min_edge, tier3_min_conf, tier3_max_stake, tier3_min_prob
) VALUES (
  true,
  42,   -- min_probability: was 30 → raised to 42
  4,    -- min_edge
  65,   -- min_confidence
  1.35, -- odd_min
  3.20, -- odd_max: was 4.50 → tightened to 3.20
  2,    -- tolerance_pp
  7, 78, 5.0, 55,   -- tier1: minEdge, minConf, maxStake, minProb (was 50→55)
  5, 70, 3.5, 48,   -- tier2: minEdge, minConf, maxStake, minProb (was 40→48)
  4, 65, 2.5, 42    -- tier3: minEdge, minConf, maxStake, minProb (was 32→42)
);
