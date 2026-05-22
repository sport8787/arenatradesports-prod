-- Desativa crons automáticos de liquidação da Arena Punter.
-- Liquidação passa a ser 100% manual via botões:
--   /punter/banca-virtual → settle-bets (virtual_bets_punter + virtual_bets_manual)
--   /punter/liquidacoes   → punter-settle-results-v3 (punter_signals)
DO $$
BEGIN
  PERFORM cron.unschedule('settle-bets-cron');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('punter-settle-v3-15min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('punter-settle-v3-daily-22h-brt');
EXCEPTION WHEN OTHERS THEN NULL; END $$;