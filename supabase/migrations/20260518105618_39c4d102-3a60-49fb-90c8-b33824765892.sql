
-- Desativa via função pública (não exige UPDATE direto na tabela)
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobid IN (18, 35, 37, 38, 58, 70, 71) LOOP
    PERFORM cron.alter_job(j.jobid, active := false);
  END LOOP;

  -- Remove duplicatas dos novos antes de re-agendar
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('punter-prelive-favorito-09h-utc','punter-prelive-geral-1130-utc') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'punter-prelive-favorito-09h-utc',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/punter-prelive-favorito',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'punter-prelive-geral-1130-utc',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/punter-prelive-geral',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
