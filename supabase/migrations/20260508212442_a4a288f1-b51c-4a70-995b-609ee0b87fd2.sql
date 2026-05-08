-- Bloqueia imediatamente trials vencidos + cron diário para manter estado canônico

-- 1) Função que expira trials passados de trial_ends_at
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.user_subscriptions
     SET is_active = false,
         allowed_arenas = ARRAY[]::text[],
         updated_at = now(),
         notes = COALESCE(notes, '') || E'\n[expire_trials ' || now()::text || '] trial vencido — acesso revogado'
   WHERE plan = 'trial'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now()
     AND is_active = true;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 2) Backfill imediato (135 trials vencidos)
SELECT public.expire_trials();

-- 3) Cron diário às 00:05 UTC para manter estado canônico
SELECT cron.unschedule('expire-trials-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-trials-daily'
);
SELECT cron.schedule(
  'expire-trials-daily',
  '5 0 * * *',
  $$ SELECT public.expire_trials(); $$
);