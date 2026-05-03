DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'liga-mycroft-weekly-recap') THEN
    PERFORM cron.unschedule('liga-mycroft-weekly-recap');
  END IF;
END $$;

SELECT cron.schedule(
  'liga-mycroft-weekly-recap',
  '0 14 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/liga-mycroft-weekly-recap',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := jsonb_build_object('source','cron','time', now())
  ) AS request_id;
  $$
);