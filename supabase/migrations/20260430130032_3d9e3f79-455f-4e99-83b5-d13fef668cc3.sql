-- Tabela de log da sequência de e-mails de onboarding/trial
CREATE TABLE IF NOT EXISTS public.email_sequencia_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  email       text NOT NULL,
  sequencia   text NOT NULL, -- 'D1' | 'D3' | 'D5' | 'D7' | 'EXPIRADO'
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  resend_id   text,
  aberto      boolean NOT NULL DEFAULT false,
  clicado     boolean NOT NULL DEFAULT false,
  CONSTRAINT email_sequencia_log_unique UNIQUE (user_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_email_seq_log_user     ON public.email_sequencia_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_seq_log_seq      ON public.email_sequencia_log(sequencia);
CREATE INDEX IF NOT EXISTS idx_email_seq_log_enviado  ON public.email_sequencia_log(enviado_em);

ALTER TABLE public.email_sequencia_log ENABLE ROW LEVEL SECURITY;

-- Apenas service_role escreve/lê. Admins (app_role='admin') podem ler para o painel.
DROP POLICY IF EXISTS "Admins read email_sequencia_log" ON public.email_sequencia_log;
CREATE POLICY "Admins read email_sequencia_log"
  ON public.email_sequencia_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- View de acompanhamento da sequência por usuário
CREATE OR REPLACE VIEW public.v_email_sequencia_status AS
SELECT
  p.user_id                                              AS user_id,
  p.username                                             AS username,
  p.created_at::date                                     AS cadastro,
  MAX(CASE WHEN l.sequencia = 'D1'       THEN '✅' END)  AS d1,
  MAX(CASE WHEN l.sequencia = 'D3'       THEN '✅' END)  AS d3,
  MAX(CASE WHEN l.sequencia = 'D5'       THEN '✅' END)  AS d5,
  MAX(CASE WHEN l.sequencia = 'D7'       THEN '✅' END)  AS d7,
  MAX(CASE WHEN l.sequencia = 'EXPIRADO' THEN '✅' END)  AS expirado,
  EXISTS (
    SELECT 1 FROM public.user_subscriptions s
    WHERE s.user_id = p.user_id AND s.is_active = true AND s.plan <> 'trial'
  )                                                      AS assinante
FROM public.profiles p
LEFT JOIN public.email_sequencia_log l ON l.user_id = p.user_id
GROUP BY p.user_id, p.username, p.created_at
ORDER BY p.created_at DESC;

-- Agendamento dos crons (08:00 BRT = 11:00 UTC, todos os dias)
-- Remove jobs antigos se existirem para idempotência
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'email-d1-boasvindas',
      'email-d3-engajamento',
      'email-d5-urgencia',
      'email-d7-ultimo-dia',
      'email-expirado-reativacao'
    )
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'email-d1-boasvindas','0 11 * * *',
  $$ SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/email-d1-boasvindas',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'email-d3-engajamento','0 11 * * *',
  $$ SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/email-d3-engajamento',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'email-d5-urgencia','0 11 * * *',
  $$ SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/email-d5-urgencia',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'email-d7-ultimo-dia','0 11 * * *',
  $$ SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/email-d7-ultimo-dia',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'email-expirado-reativacao','0 11 * * *',
  $$ SELECT net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/email-expirado-reativacao',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  ); $$
);