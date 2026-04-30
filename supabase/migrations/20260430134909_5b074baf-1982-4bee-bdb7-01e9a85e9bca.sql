
DROP VIEW IF EXISTS public.v_email_status_por_usuario;
CREATE VIEW public.v_email_status_por_usuario
WITH (security_invoker = true) AS
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
