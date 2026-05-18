-- Adiciona BACK_0x0 às listas permitidas de placar-alvo / alternativo
ALTER TABLE public.eventos_raros_candidatos
  DROP CONSTRAINT IF EXISTS eventos_raros_candidatos_placar_alvo_check;
ALTER TABLE public.eventos_raros_candidatos
  ADD CONSTRAINT eventos_raros_candidatos_placar_alvo_check
  CHECK (placar_alvo IN ('LAY_GOLEADA','LAY_2x2','LAY_1x3','LAY_3x1','BACK_0x0'));

ALTER TABLE public.eventos_raros_candidatos
  DROP CONSTRAINT IF EXISTS eventos_raros_candidatos_placar_alternativo_check;
ALTER TABLE public.eventos_raros_candidatos
  ADD CONSTRAINT eventos_raros_candidatos_placar_alternativo_check
  CHECK (placar_alternativo IS NULL OR placar_alternativo IN ('LAY_GOLEADA','LAY_2x2','LAY_1x3','LAY_3x1','BACK_0x0'));

-- Frequência de 0x0 no H2H recente
ALTER TABLE public.eventos_raros_candidatos
  ADD COLUMN IF NOT EXISTS freq_0x0_h2h numeric DEFAULT 0;