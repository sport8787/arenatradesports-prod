
CREATE OR REPLACE FUNCTION public.cleanup_log_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  c bigint;
BEGIN
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('cron_job_run_details', c);

  DELETE FROM net._http_response WHERE created < now() - interval '1 day';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('net_http_response', c);

  DELETE FROM public.edge_function_errors WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('edge_function_errors', c);

  DELETE FROM public.cron_logs WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('cron_logs', c);

  DELETE FROM public.edge_function_runs WHERE started_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('edge_function_runs', c);

  DELETE FROM public.ai_response_cache WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('ai_response_cache', c);

  DELETE FROM public.mycroft_settlement_log WHERE created_at < now() - interval '14 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('mycroft_settlement_log', c);

  DELETE FROM public.poisson_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('poisson_log', c);

  DELETE FROM public.futodds_health_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('futodds_health_log', c);

  DELETE FROM public.mycroft_vetoed_log WHERE created_at < now() - interval '14 days';
  GET DIAGNOSTICS c = ROW_COUNT; result := result || jsonb_build_object('mycroft_vetoed_log', c);

  RETURN result;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-log-tables-daily') THEN
    PERFORM cron.unschedule('cleanup-log-tables-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-log-tables-daily',
  '30 4 * * *',
  $$ SELECT public.cleanup_log_tables(); $$
);
