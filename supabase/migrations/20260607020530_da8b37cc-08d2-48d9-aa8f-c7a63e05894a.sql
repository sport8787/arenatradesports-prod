DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname IN (
    'mycroft-punter-morning',
    'mycroft-punter-sportmonks-9h-brt',
    'punter-cards-morning',
    'punter-extra-markets-morning',
    'punter-players-morning',
    'punter-players-afternoon',
    'punter-prelive-ah-1130-brt',
    'punter-prelive-cards-1430-brt',
    'punter-prelive-extra-2030-brt',
    'punter-prelive-favorito-09h-utc',
    'punter-prelive-players-1730-brt',
    'punter-daily-summary-telegram-23h',
    'punter-bucket-calibration-daily',
    'punter-clv-capture-5min',
    'punter-clv-snapshot',
    'punter-steam-monitor-2min'
  ) LOOP
    PERFORM cron.alter_job(job_id := r.jobid, active := true);
  END LOOP;
END $$;