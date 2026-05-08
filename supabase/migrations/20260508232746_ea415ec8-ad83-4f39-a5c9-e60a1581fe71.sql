INSERT INTO public.cron_settings (setting_key, is_enabled)
VALUES ('borderline_ai_validator', true)
ON CONFLICT (setting_key) DO NOTHING;