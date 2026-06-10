-- Kill switch global: desativa todos os toggles e despausa pg_cron jobs
UPDATE public.cron_settings SET is_enabled = false, updated_at = now();

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE active = true LOOP
    PERFORM cron.alter_job(job_id := r.jobid, active := false);
    RAISE NOTICE 'Pausado: % (id=%)', r.jobname, r.jobid;
  END LOOP;
END $$;