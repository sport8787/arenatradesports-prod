CREATE TABLE IF NOT EXISTS public.trial_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  days_left int NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, days_left, channel)
);
ALTER TABLE public.trial_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view trial notif log" ON public.trial_notification_log FOR SELECT USING (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_trial_notif_user ON public.trial_notification_log(user_id);