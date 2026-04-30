DROP VIEW IF EXISTS public.v_email_sequencia_status;

CREATE VIEW public.v_email_sequencia_status
WITH (security_invoker = true) AS
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

REVOKE ALL ON public.v_email_sequencia_status FROM anon, authenticated;
GRANT SELECT ON public.v_email_sequencia_status TO authenticated;