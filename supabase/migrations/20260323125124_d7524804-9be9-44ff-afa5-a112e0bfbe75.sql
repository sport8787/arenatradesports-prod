
-- Create normalization function
CREATE OR REPLACE FUNCTION public.normalize_match_id(mid text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(mid, '\+00:00', 'Z', 'g')
$$;
