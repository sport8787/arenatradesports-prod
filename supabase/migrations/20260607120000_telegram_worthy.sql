-- ============================================================
-- telegram_worthy — filtro duplo qualidade × mercado (2026-06-07)
--
-- Critério para ir ao Telegram:
--   1) Mercado prioritário: Over 0.5 HT | Over 1.5 | Próximo Gol | Back favorito
--   2) Qualidade: LABAREDA  OU  (APROVADO com confidence >= 70)
--   NUNCA: APROVADO_SITUACIONAL (conf. reduzida = stake 2%, não é vitrine)
-- ============================================================

ALTER TABLE public.mycroft_analyses
  ADD COLUMN IF NOT EXISTS telegram_worthy boolean NOT NULL DEFAULT false;

-- Backfill para registros existentes que atendem o critério
-- (útil para os resultados dos últimos dias)
UPDATE public.mycroft_analyses
SET telegram_worthy = true
WHERE
  -- Mercado prioritário
  (
    market ~* 'over\s*0\.5\s*(ht|1t|primeiro|first|half)'
    OR market ~* 'over\s*1\.5'
    OR market ~* 'pr[oó]ximo\s*gol'
    OR market ~* 'next\s*goal'
    OR market ~* 'back.*favorit'
    OR market ~* 'favorit.*back'
    OR market ~* 'back.*dominan'
    OR market ~* 'dominan.*back'
  )
  -- Qualidade
  AND (
    verdict = 'LABAREDA'
    OR (verdict = 'APROVADO' AND confidence >= 70)
  );

-- Índice para o sweep do live-telegram-results
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_worthy_sweep
  ON public.mycroft_analyses (telegram_worthy, sent_result_telegram, settled_at)
  WHERE telegram_worthy = true AND result IN ('GREEN','RED') AND sent_result_telegram = false;
