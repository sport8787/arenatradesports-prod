-- Reset de tentativas para análises travadas em 8 (limite antigo).
-- Permite que o novo punter-settle-results (com cascata virtual_bets_manual + persistência de placar) reprocesse.
UPDATE public.punter_analyses
SET settle_attempts = 0,
    last_settle_attempt_at = NULL
WHERE result IS NULL
  AND settle_attempts >= 8
  AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
  AND commence_time < now() - interval '2 hours';