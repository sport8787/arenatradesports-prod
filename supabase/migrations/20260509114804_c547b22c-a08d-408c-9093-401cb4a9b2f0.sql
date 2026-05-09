SELECT cron.schedule(
  'update-live-odds-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://affquongjlhmusxzohjl.supabase.co/functions/v1/update-live-odds',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  );
  $$
);