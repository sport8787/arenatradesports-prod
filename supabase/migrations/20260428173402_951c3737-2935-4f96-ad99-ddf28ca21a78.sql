SELECT cron.schedule(
  'trial-expiry-notify-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/trial-expiry-notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);