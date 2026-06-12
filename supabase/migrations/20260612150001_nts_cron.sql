-- Cron diário para atualizar estatísticas das seleções Copa 2026
-- Executa às 03:00 UTC — antes do cron copa-fixtures-sync (09:00)

SELECT cron.schedule(
  'fetch-national-team-stats',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/fetch-national-team-stats',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY')
      ),
      body    := '{"last":10}'::jsonb
    ) AS request_id;
  $$
);
