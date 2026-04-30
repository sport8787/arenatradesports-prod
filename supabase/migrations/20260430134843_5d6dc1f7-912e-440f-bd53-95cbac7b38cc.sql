
-- Adiciona colunas de depuração ao log
ALTER TABLE public.email_sequencia_log
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Constraint de status conhecidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sequencia_log_status_check'
  ) THEN
    ALTER TABLE public.email_sequencia_log
      ADD CONSTRAINT email_sequencia_log_status_check
      CHECK (status IN ('sent','failed','skipped','pending'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_seq_log_status ON public.email_sequencia_log(status);

-- View consolidada por usuário (apenas para admins)
CREATE OR REPLACE VIEW public.v_email_status_por_usuario AS
SELECT
  l.user_id,
  l.email,
  MAX(CASE WHEN l.sequencia = 'D1' THEN l.enviado_em END)        AS d1_enviado_em,
  MAX(CASE WHEN l.sequencia = 'D1' THEN l.status END)            AS d1_status,
  MAX(CASE WHEN l.sequencia = 'D1' THEN l.error_message END)     AS d1_erro,
  MAX(CASE WHEN l.sequencia = 'D3' THEN l.enviado_em END)        AS d3_enviado_em,
  MAX(CASE WHEN l.sequencia = 'D3' THEN l.status END)            AS d3_status,
  MAX(CASE WHEN l.sequencia = 'D5' THEN l.enviado_em END)        AS d5_enviado_em,
  MAX(CASE WHEN l.sequencia = 'D5' THEN l.status END)            AS d5_status,
  MAX(CASE WHEN l.sequencia = 'D7' THEN l.enviado_em END)        AS d7_enviado_em,
  MAX(CASE WHEN l.sequencia = 'D7' THEN l.status END)            AS d7_status,
  MAX(CASE WHEN l.sequencia = 'EXPIRADO' THEN l.enviado_em END)  AS expirado_enviado_em,
  MAX(CASE WHEN l.sequencia = 'EXPIRADO' THEN l.status END)      AS expirado_status,
  COUNT(*) FILTER (WHERE l.status = 'sent')   AS total_enviados,
  COUNT(*) FILTER (WHERE l.status = 'failed') AS total_falhas
FROM public.email_sequencia_log l
GROUP BY l.user_id, l.email;
