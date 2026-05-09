
-- Calibração de mercado 1X2 baseada em ROI auditado (60d):
--   - EMPATE: ROI -29.2% → vetar sempre
--   - FORA com odd > 2.40: ROI ~ -0.1% mas alta variância → vetar
--   - CASA: ROI +10.2% → manter
-- Aplica universalmente em qualquer insert/update em punter_analyses.

CREATE OR REPLACE FUNCTION public.calibrate_punter_1x2_verdict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  m_lower text := lower(coalesce(NEW.market, ''));
  is_empate boolean;
  is_fora boolean;
  reason text;
BEGIN
  -- Só intervém em sinais aprovados
  IF NEW.verdict NOT IN ('APROVADO', 'APROVADO_SITUACIONAL') THEN
    RETURN NEW;
  END IF;

  is_empate := (m_lower ~ '(^|[^a-z])(empate|draw)([^a-z]|$)')
               AND m_lower !~ 'no draw|sem empate|double chance|dupla chance';

  is_fora := (m_lower ~ '(fora|away)') 
             AND m_lower !~ 'over|under|btts|escante|corner|asiat|handicap|ah'
             AND (m_lower ~ '1x2|match|winner|resultado' OR m_lower ~ '^(fora|away)');

  IF is_empate THEN
    reason := 'CALIBRAÇÃO: Mercado EMPATE descontinuado (ROI -29.2% em 60d auditados).';
  ELSIF is_fora AND NEW.odd IS NOT NULL AND NEW.odd > 2.40 THEN
    reason := format('CALIBRAÇÃO: Vitória FORA com odd %.2f > 2.40 vetada (FORA-zebra historicamente -EV).', NEW.odd);
  ELSE
    RETURN NEW;
  END IF;

  NEW.verdict := 'RECUSADO';
  NEW.thesis := reason || E'\n\n' || coalesce(NEW.thesis, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calibrate_punter_1x2_verdict_trigger ON public.punter_analyses;

CREATE TRIGGER calibrate_punter_1x2_verdict_trigger
BEFORE INSERT OR UPDATE OF verdict, market, odd
ON public.punter_analyses
FOR EACH ROW
EXECUTE FUNCTION public.calibrate_punter_1x2_verdict();
