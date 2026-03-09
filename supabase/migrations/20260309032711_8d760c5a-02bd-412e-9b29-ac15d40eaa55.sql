
-- 1. Add notification tracking columns to punter_analyses
ALTER TABLE public.punter_analyses
ADD COLUMN IF NOT EXISTS sent_to_telegram BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_to_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_punter_analyses_sent_telegram ON public.punter_analyses(sent_to_telegram) WHERE verdict = 'APROVADO';
CREATE INDEX IF NOT EXISTS idx_punter_analyses_sent_email ON public.punter_analyses(sent_to_email) WHERE verdict = 'APROVADO';

-- 3. Add notification preferences to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS telegram_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_email TEXT;
