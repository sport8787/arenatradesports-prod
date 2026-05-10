-- ============================================================
-- 1. virtual_bets_manual — sem índices além da PK (CRÍTICO)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vbm_user_status
  ON public.virtual_bets_manual (user_id, status);

CREATE INDEX IF NOT EXISTS idx_vbm_user_created
  ON public.virtual_bets_manual (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vbm_user_match
  ON public.virtual_bets_manual (user_id, match_id);

CREATE INDEX IF NOT EXISTS idx_vbm_status_pending
  ON public.virtual_bets_manual (user_id, created_at DESC)
  WHERE status = 'pending';

-- ============================================================
-- 2. scheduled_games — reforço de índices p/ filtros de liga
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_games_league
  ON public.scheduled_games (league_name);

CREATE INDEX IF NOT EXISTS idx_scheduled_games_datetime
  ON public.scheduled_games (match_datetime);

-- ============================================================
-- 3. Limpeza imediata de logs antigos (libera IO + espaço)
-- ============================================================
DELETE FROM cron.job_run_details
  WHERE end_time < now() - interval '7 days';

DELETE FROM public.cron_logs
  WHERE created_at < now() - interval '7 days';

-- ============================================================
-- 4. ANALYZE para o planner reaproveitar os novos índices
-- ============================================================
ANALYZE public.virtual_bets_manual;
ANALYZE public.scheduled_games;
ANALYZE public.mycroft_analyses;