CREATE TABLE public.cron_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.cron_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cron_settings"
  ON public.cron_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update cron_settings"
  ON public.cron_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.cron_settings (setting_key, is_enabled)
VALUES ('live_matches_cron', false);