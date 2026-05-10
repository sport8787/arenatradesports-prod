-- ============================================================
-- HARDENING DE PERFORMANCE — auditoria identificou:
-- scheduled_games: 337M rows lidos via seq_scan (14k scans em 30k linhas)
-- mycroft_analyses: 81M rows lidos via seq_scan
-- virtual_bets_punter: 2.6M rows lidos via seq_scan
-- ============================================================

-- 1) scheduled_games: query mais comum filtra por status + match_datetime futuro
CREATE INDEX IF NOT EXISTS idx_scheduled_games_status_datetime
  ON public.scheduled_games (status, match_datetime);

-- match_id também é muito procurado
CREATE INDEX IF NOT EXISTS idx_scheduled_games_match_id
  ON public.scheduled_games (match_id);

-- 2) mycroft_analyses: filtros comuns por verdict aprovado + sem resultado
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_active_verdicts
  ON public.mycroft_analyses (verdict, created_at DESC)
  WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') AND result IS NULL;

-- match_id + market é usado pelas triggers de propagação shadow
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_match_market
  ON public.mycroft_analyses (match_id, market);

-- 3) virtual_bets_punter: filtros por user_id + status
CREATE INDEX IF NOT EXISTS idx_virtual_bets_punter_user_status
  ON public.virtual_bets_punter (user_id, status, created_at DESC);

-- 4) Retenção automática de logs (já existem funções cleanup, vamos garantir cron)
-- edge_function_errors: 79MB, retenção 7 dias já definida
-- edge_function_runs: 14MB, retenção 7 dias já definida
-- futodds_health_log: retenção 7 dias já definida
-- cron_logs: 21MB — adicionar retenção 14 dias
CREATE OR REPLACE FUNCTION public.cleanup_cron_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.cron_logs WHERE created_at < now() - interval '14 days';
$$;

-- ai_response_cache: 55MB — limpar entradas expiradas
CREATE OR REPLACE FUNCTION public.cleanup_ai_response_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_response_cache
  WHERE created_at < now() - interval '7 days';
$$;

-- Schedule diário 04h UTC (01h BR — fora do horário ativo)
SELECT cron.schedule(
  'cleanup-logs-daily',
  '0 4 * * *',
  $$
  SELECT public.cleanup_cron_logs();
  SELECT public.cleanup_ai_response_cache();
  SELECT public.cleanup_old_edge_function_errors();
  SELECT public.cleanup_old_edge_function_runs();
  SELECT public.cleanup_futodds_health_log();
  SELECT public.cleanup_mycroft_analysis_queue();
  $$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-logs-daily');

-- ANALYZE para o planner reaproveitar os índices novos imediatamente
ANALYZE public.scheduled_games;
ANALYZE public.mycroft_analyses;
ANALYZE public.virtual_bets_punter;