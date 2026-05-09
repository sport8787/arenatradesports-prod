
-- Calibração v2 baseada em ROI auditado (60d) — mercados Over/Under
--   - Over 2.5: ROI -52% → vetar
--   - Linhas asiáticas (2.25, 2.75, 3.0, 3.25, etc): -51% e settlement incompatível → vetar
--   - Cartões com odd inválida: bloqueado até gerador corrigir
-- Continua aplicando regras 1X2 anteriores (Empate, Fora>2.40)

CREATE OR REPLACE FUNCTION public.calibrate_punter_1x2_verdict()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m_lower text := lower(coalesce(NEW.market, ''));
  is_empate boolean;
  is_fora boolean;
  is_over25 boolean;
  is_asian_line boolean;
  is_cards_no_odd boolean;
  reason text;
  line_match text;
  line_num numeric;
BEGIN
  IF NEW.verdict NOT IN ('APROVADO', 'APROVADO_SITUACIONAL') THEN
    RETURN NEW;
  END IF;

  -- 1X2: Empate
  is_empate := (m_lower ~ '(^|[^a-z])(empate|draw)([^a-z]|$)')
               AND m_lower !~ 'no draw|sem empate|double chance|dupla chance';

  -- 1X2: Fora favorito
  is_fora := (m_lower ~ '(fora|away)') 
             AND m_lower !~ 'over|under|btts|escante|corner|asiat|handicap|ah'
             AND (m_lower ~ '1x2|match|winner|resultado' OR m_lower ~ '^(fora|away)');

  -- Over 2.5 (gols totais — não confundir com escanteios/cartões/asian)
  is_over25 := (m_lower ~ '(^|[^a-z0-9])over\s*2\.5([^0-9]|$)')
               AND m_lower !~ 'escante|corner|cart|card|asiat|handicap|ah';

  -- Linha asiática (Over/Under com .25 ou .75 ou inteiro como 3.0/2.0)
  -- Extrai o número decimal após Over/Under
  line_match := substring(m_lower from '(?:over|under)\s*(\d+(?:\.\d+)?)');
  IF line_match IS NOT NULL THEN
    line_num := line_match::numeric;
    -- Aceita apenas linhas X.5 (1.5, 2.5, 3.5, 4.5)
    is_asian_line := (line_num * 10)::int % 10 != 5
                     AND m_lower !~ 'escante|corner|cart|card';
  ELSE
    is_asian_line := false;
  END IF;

  -- Cartões com odd inválida (gerador quebrado — auditoria impossível)
  is_cards_no_odd := (m_lower ~ '(cart|card|yellow)') 
                     AND (NEW.odd IS NULL OR NEW.odd < 1.01);

  IF is_empate THEN
    reason := 'CALIBRAÇÃO: Mercado EMPATE descontinuado (ROI -29.2% em 60d auditados).';
  ELSIF is_fora AND NEW.odd IS NOT NULL AND NEW.odd > 2.40 THEN
    reason := format('CALIBRAÇÃO: Vitória FORA com odd %.2f > 2.40 vetada (FORA-zebra historicamente -EV).', NEW.odd);
  ELSIF is_over25 THEN
    reason := 'CALIBRAÇÃO: Over 2.5 descontinuado (ROI -52% em 60d auditados, hit-rate 25% vs breakeven 48%).';
  ELSIF is_asian_line THEN
    reason := format('CALIBRAÇÃO: Linha asiática Over/Under %s vetada (ROI -51% e settlement binário incompatível). Apenas linhas X.5 aceitas.', line_match);
  ELSIF is_cards_no_odd THEN
    reason := 'CALIBRAÇÃO: Mercado de Cartões bloqueado — odd decimal não foi salva, auditoria impossível.';
  ELSE
    RETURN NEW;
  END IF;

  NEW.verdict := 'RECUSADO';
  NEW.thesis := reason || E'\n\n' || coalesce(NEW.thesis, '');
  RETURN NEW;
END;
$$;
