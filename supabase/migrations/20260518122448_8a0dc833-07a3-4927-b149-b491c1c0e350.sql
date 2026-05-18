
ALTER TABLE public.punter_sinais
  ADD COLUMN IF NOT EXISTS approval_block text;

CREATE INDEX IF NOT EXISTS idx_punter_sinais_block_date ON public.punter_sinais(approval_block, match_date DESC) WHERE approval_block IS NOT NULL;

UPDATE public.punter_sinais
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
