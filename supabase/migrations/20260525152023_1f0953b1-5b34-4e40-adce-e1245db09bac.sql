-- Remove Shadow AF (API-Football descontinuada)
DROP TRIGGER IF EXISTS auto_settle_shadow_af ON public.live_matches;
DROP TRIGGER IF EXISTS trg_settle_shadow_af_on_insert ON public.mycroft_analyses_shadow_af;
DROP FUNCTION IF EXISTS public.settle_mycroft_shadow_af(uuid, integer, integer, text);
DROP FUNCTION IF EXISTS public.settle_mycroft_shadow_af(uuid, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.compare_providers_metrics(timestamptz);
DROP FUNCTION IF EXISTS public.compare_providers_divergences(timestamptz);
DELETE FROM public.cron_settings WHERE setting_key = 'shadow_af_cron';
DROP TABLE IF EXISTS public.mycroft_analyses_shadow_af CASCADE;