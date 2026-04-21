-- 1) Limpar duplicatas antes de criar índice único
WITH ranked AS (
  SELECT id, match_id, market,
         ROW_NUMBER() OVER (PARTITION BY match_id, market ORDER BY created_at DESC) AS rn
  FROM public.punter_analyses
)
DELETE FROM public.punter_analyses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Índice único para upsert
CREATE UNIQUE INDEX IF NOT EXISTS uniq_punter_analyses_match_market
  ON public.punter_analyses (match_id, market);

-- 3) Cron jobs (5 min após cron principal do Punter)
SELECT cron.schedule(
  'mycroft-extra-markets-morning',
  '35 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/mycroft-extra-markets',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'mycroft-extra-markets-afternoon',
  '35 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/mycroft-extra-markets',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'mycroft-cards-morning',
  '40 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/mycroft-cards-punter',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'mycroft-cards-afternoon',
  '40 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/mycroft-cards-punter',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30.MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);