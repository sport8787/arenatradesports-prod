
-- Adiciona colunas de bloco de aprovação ao Punter
ALTER TABLE public.punter_analyses
  ADD COLUMN IF NOT EXISTS approval_block text,
  ADD COLUMN IF NOT EXISTS gate_demoted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_veto_reason text,
  ADD COLUMN IF NOT EXISTS gate_block_reason text;

ALTER TABLE public.punter_signals
  ADD COLUMN IF NOT EXISTS approval_block text;

CREATE INDEX IF NOT EXISTS idx_punter_analyses_block ON public.punter_analyses(approval_block) WHERE approval_block IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punter_analyses_block_created ON public.punter_analyses(approval_block, created_at DESC) WHERE approval_block IS NOT NULL;

-- Backfill histórico aplicando a mesma classificação A/B/C
UPDATE public.punter_analyses
SET approval_block = CASE
  WHEN estimated_probability >= 55 AND value_percentage >= 7 AND confidence >= 80
       AND odd BETWEEN 1.50 AND 4.50 AND lower(coalesce(bookmaker,'')) LIKE '%pinnacle%'
    THEN 'C'
  WHEN estimated_probability >= 45 AND value_percentage >= 5 AND confidence >= 70
       AND odd BETWEEN 1.85 AND 3.20
    THEN 'B'
  WHEN estimated_probability >= 58 AND value_percentage >= 3 AND confidence >= 72
       AND odd BETWEEN 1.30 AND 1.85
    THEN 'A'
  ELSE NULL
END
WHERE approval_block IS NULL
  AND verdict ILIKE 'APROVADO%'
  AND estimated_probability IS NOT NULL
  AND value_percentage IS NOT NULL
  AND confidence IS NOT NULL
  AND odd IS NOT NULL;

-- Sincroniza nos sinais
UPDATE public.punter_signals s
SET approval_block = a.approval_block
FROM public.punter_analyses a
WHERE s.analysis_id = a.id
  AND s.approval_block IS NULL
  AND a.approval_block IS NOT NULL;
