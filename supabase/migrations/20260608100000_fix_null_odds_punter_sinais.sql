-- ============================================================
-- Fix: odd NULL em punter_sinais para mercados over15 / over25
-- O plano-favorito-prelive passou null para over15/over25 antes
-- de ter o fallback implementado. Corrige histórico + evita futuro.
-- ============================================================

-- 1) Corrige registros já existentes
UPDATE public.punter_sinais
SET odd = 1.40
WHERE odd IS NULL
  AND market ILIKE '%over%1.5%';

UPDATE public.punter_sinais
SET odd = 1.85
WHERE odd IS NULL
  AND market ILIKE '%over%2.5%';

-- 2) Mesmo fix na punter_analyses (tabela irmã)
UPDATE public.punter_analyses
SET odd = 1.40
WHERE odd IS NULL
  AND market ILIKE '%over%1.5%';

UPDATE public.punter_analyses
SET odd = 1.85
WHERE odd IS NULL
  AND market ILIKE '%over%2.5%';

-- 3) Garante que novos inserts com odd NULL herdam o fallback via CHECK + DEFAULT
--    (não coloca DEFAULT fixo pois a odd depende do mercado — mantemos a regra no código)
--    Em vez disso, cria uma função trigger que aplica o fallback automaticamente.

CREATE OR REPLACE FUNCTION public.fn_punter_sinais_odd_fallback()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.odd IS NULL OR NEW.odd <= 1.0 THEN
    IF NEW.market ILIKE '%over%1.5%' THEN
      NEW.odd := 1.40;
    ELSIF NEW.market ILIKE '%over%2.5%' THEN
      NEW.odd := 1.85;
    ELSIF NEW.market ILIKE '%over%3.5%' THEN
      NEW.odd := 2.30;
    ELSE
      NEW.odd := 1.90; -- fallback genérico
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_punter_sinais_odd_fallback ON public.punter_sinais;
CREATE TRIGGER trg_punter_sinais_odd_fallback
  BEFORE INSERT OR UPDATE OF odd ON public.punter_sinais
  FOR EACH ROW EXECUTE FUNCTION public.fn_punter_sinais_odd_fallback();

-- Mesmo trigger para punter_analyses
CREATE OR REPLACE FUNCTION public.fn_punter_analyses_odd_fallback()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.odd IS NULL OR NEW.odd <= 1.0 THEN
    IF NEW.market ILIKE '%over%1.5%' THEN
      NEW.odd := 1.40;
    ELSIF NEW.market ILIKE '%over%2.5%' THEN
      NEW.odd := 1.85;
    ELSIF NEW.market ILIKE '%over%3.5%' THEN
      NEW.odd := 2.30;
    ELSE
      NEW.odd := 1.90;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_punter_analyses_odd_fallback ON public.punter_analyses;
CREATE TRIGGER trg_punter_analyses_odd_fallback
  BEFORE INSERT OR UPDATE OF odd ON public.punter_analyses
  FOR EACH ROW EXECUTE FUNCTION public.fn_punter_analyses_odd_fallback();
