-- Desativar todos os crons Punter
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname ILIKE '%punter%' AND jobname <> 'punter-prelive-sportmonks-0830-brt'
  LOOP
    PERFORM cron.alter_job(job_id := j.jobid, active := false);
  END LOOP;
END $$;

-- Reagendar o único cron ativo para 11:00 UTC (08:00 BRT) e garantir ativo
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'punter-prelive-sportmonks-0830-brt'),
  schedule := '0 11 * * *',
  active := true
);