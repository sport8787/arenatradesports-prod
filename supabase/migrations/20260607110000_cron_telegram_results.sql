-- ============================================================
-- pg_cron: notificações Telegram por Arena (2026-06-07)
-- Arena Punter → punter-telegram-results  (a cada 10 min)
-- Arena Live   → live-telegram-results    (a cada 10 min)
-- ============================================================

-- Remove entradas antigas se existirem (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-punter-telegram-results') THEN
    PERFORM cron.unschedule('cron-punter-telegram-results');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-live-telegram-results') THEN
    PERFORM cron.unschedule('cron-live-telegram-results');
  END IF;
END $$;

-- Arena Punter: varre punter_analyses a cada 10 min
SELECT cron.schedule(
  'cron-punter-telegram-results',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ogpohiugfkvygcejrzfp.supabase.co/functions/v1/punter-telegram-results',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"}'::jsonb,
    body    := '{"source":"cron"}'::jsonb
  );
  $$
);

-- Arena Live: varre mycroft_analyses + live_sinais a cada 10 min
SELECT cron.schedule(
  'cron-live-telegram-results',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ogpohiugfkvygcejrzfp.supabase.co/functions/v1/live-telegram-results',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"}'::jsonb,
    body    := '{"source":"cron"}'::jsonb
  );
  $$
);
