-- ============================================================
-- ROI + Telegram fixes (2026-06-07)
-- 1. Adiciona stake_pct em mycroft_analyses (IA já retorna, faltava coluna)
-- 2. Adiciona sent_result_telegram em mycroft_analyses e live_sinais
--    (flag de controle para o sweep do punter-telegram-results)
-- ============================================================

-- 1) mycroft_analyses: stake_pct + flag Telegram resultado
ALTER TABLE public.mycroft_analyses
  ADD COLUMN IF NOT EXISTS stake_pct      numeric         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sent_result_telegram boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_telegram_sent_at timestamptz;

-- Índice para sweep eficiente (apenas registros liquidados ainda não enviados)
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_telegram_sweep
  ON public.mycroft_analyses (sent_result_telegram, settled_at)
  WHERE result IN ('GREEN','RED','VOID') AND sent_result_telegram = false;

-- 2) live_sinais: flag Telegram resultado
ALTER TABLE public.live_sinais
  ADD COLUMN IF NOT EXISTS sent_result_telegram boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_telegram_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_live_sinais_telegram_sweep
  ON public.live_sinais (sent_result_telegram, settled_at)
  WHERE result IN ('GREEN','RED') AND sent_result_telegram = false;
