-- Arena Live: crons sub-minuto via pg_sleep
-- update-live-scores: 6× a cada 10s (placar + stats Futodds)
-- analyze-live-matches: 2× a cada 30s (análise determinística)
-- Requer: pg_net e pg_cron habilitados no projeto Supabase.

-- ── update-live-scores: 6 chamadas × 10s ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_update_live_scores_loop()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _url     text   := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/update-live-scores';
  _headers jsonb  := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb;
  _body    jsonb  := '{"source": "cron"}'::jsonb;
BEGIN
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=0s
  PERFORM pg_sleep(10);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=10s
  PERFORM pg_sleep(10);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=20s
  PERFORM pg_sleep(10);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=30s
  PERFORM pg_sleep(10);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=40s
  PERFORM pg_sleep(10);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=50s
END;
$$;

-- ── analyze-live-matches: 2 chamadas × 30s ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_analyze_live_30s()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _url     text   := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/analyze-live-matches';
  _headers jsonb  := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb;
  _body    jsonb  := '{"source": "cron"}'::jsonb;
BEGIN
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=0s
  PERFORM pg_sleep(30);
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);  -- t=30s
END;
$$;

-- ── Registrar os crons ─────────────────────────────────────────────────────────
-- Remove versões antigas se existirem
SELECT cron.unschedule('update-live-scores-10s') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-live-scores-10s'
);
SELECT cron.unschedule('analyze-live-30s') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'analyze-live-30s'
);

SELECT cron.schedule(
  'update-live-scores-10s',
  '* * * * *',
  'SELECT public.trigger_update_live_scores_loop()'
);

SELECT cron.schedule(
  'analyze-live-30s',
  '* * * * *',
  'SELECT public.trigger_analyze_live_30s()'
);
