-- Crons para capture-prelive-odds e populate CLV closes
-- capture-prelive-odds: a cada 30min (auto mode → opening se novo, closing se ≤60min)
-- clv-engine populate_closes: diário às 23h (popula odd_close dos últimos 3 dias)

-- ── Função: capture-prelive-odds a cada 30min ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_capture_prelive_odds()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _url     text   := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/capture-prelive-odds';
  _headers jsonb  := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb;
  _body    jsonb  := '{"mode": "auto", "days_ahead": 2}'::jsonb;
BEGIN
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);
END;
$$;

-- ── Função: populate CLV closes diário ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_clv_populate_closes()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _url     text   := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/clv-engine';
  _headers jsonb  := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb;
  _body    jsonb  := '{"populate_closes": true, "days": 3}'::jsonb;
BEGIN
  PERFORM net.http_post(url := _url, headers := _headers, body := _body);
END;
$$;

-- ── Registrar crons ────────────────────────────────────────────────────────────
SELECT cron.unschedule('capture-prelive-odds-30m') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'capture-prelive-odds-30m'
);
SELECT cron.unschedule('clv-populate-closes-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'clv-populate-closes-daily'
);

-- A cada 30 minutos (cobre todo o dia)
SELECT cron.schedule(
  'capture-prelive-odds-30m',
  '*/30 * * * *',
  'SELECT public.trigger_capture_prelive_odds()'
);

-- Diário às 23h (consolida odd_close para bets dos últimos 3 dias)
SELECT cron.schedule(
  'clv-populate-closes-daily',
  '0 23 * * *',
  'SELECT public.trigger_clv_populate_closes()'
);

-- ── Limpeza automática de snapshots antigos (>30 dias) ────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_betfair_odds_snapshot()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.betfair_odds_snapshot
  WHERE captured_at < now() - INTERVAL '30 days';
END;
$$;

SELECT cron.unschedule('cleanup-betfair-snapshots') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-betfair-snapshots'
);

SELECT cron.schedule(
  'cleanup-betfair-snapshots',
  '0 4 * * 0',  -- toda domingo às 4h
  'SELECT public.cleanup_betfair_odds_snapshot()'
);
