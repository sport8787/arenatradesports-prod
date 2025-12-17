-- Fix search_path for calculate_rank_title function
CREATE OR REPLACE FUNCTION public.calculate_rank_title(coins integer)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coins >= 1000000 THEN
    RETURN 'Lenda';
  ELSIF coins >= 100000 THEN
    RETURN 'Mestre';
  ELSIF coins >= 10000 THEN
    RETURN 'Trapaceiro';
  ELSE
    RETURN 'Novato';
  END IF;
END;
$$;