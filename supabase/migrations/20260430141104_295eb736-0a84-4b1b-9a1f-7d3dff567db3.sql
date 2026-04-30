ALTER TABLE public.email_sequencia_log
  ADD COLUMN IF NOT EXISTS resend_response jsonb,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS http_status integer;
CREATE INDEX IF NOT EXISTS idx_email_seq_log_status_seq ON public.email_sequencia_log (status, sequencia, enviado_em DESC);