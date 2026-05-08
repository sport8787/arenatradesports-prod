
CREATE TABLE IF NOT EXISTS public.futodds_health_log (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  status_code INT,
  latency_ms INT,
  ok BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  leagues_count INT,
  items_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS futodds_health_log_created_idx ON public.futodds_health_log(created_at DESC);
CREATE INDEX IF NOT EXISTS futodds_health_log_endpoint_idx ON public.futodds_health_log(endpoint, created_at DESC);

ALTER TABLE public.futodds_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read futodds health" ON public.futodds_health_log;
CREATE POLICY "Admins read futodds health"
ON public.futodds_health_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Cleanup antigo (manter 7 dias)
CREATE OR REPLACE FUNCTION public.cleanup_futodds_health_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.futodds_health_log WHERE created_at < now() - interval '7 days';
$$;

-- Cron: executar futodds-upcoming-cache a cada 60s
DO $$
DECLARE
  supabase_url TEXT := 'https://affquongjlhmusxzohjl.supabase.co';
  service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Remover cron antigo se existir
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'futodds-upcoming-cache-60s';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'futodds-upcoming-cache-60s',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/futodds-upcoming-cache',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('source','cron')
  );
  $$
);
