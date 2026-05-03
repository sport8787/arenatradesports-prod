-- Remove job anterior se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'seo-publish-rodada-daily') THEN
    PERFORM cron.unschedule('seo-publish-rodada-daily');
  END IF;
END $$;

-- Cron: 06h UTC todos os dias
SELECT cron.schedule(
  'seo-publish-rodada-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/seo-publish-rodada',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := jsonb_build_object('source','cron','time', now())
  ) AS request_id;
  $$
);