-- Make email optional and add name (required) + ensure whatsapp is required for new leads
ALTER TABLE public.landing_leads
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.landing_leads
  ADD COLUMN IF NOT EXISTS name text;

-- Backfill name for existing rows so we can require it going forward isn't possible without breaking history;
-- instead enforce at application layer + add a soft check via trigger for new rows only.
CREATE OR REPLACE FUNCTION public.validate_landing_lead()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) < 2 THEN
    RAISE EXCEPTION 'name is required (min 2 chars)';
  END IF;
  IF NEW.whatsapp IS NULL OR length(regexp_replace(NEW.whatsapp, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'whatsapp is required (min 10 digits)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_landing_lead_trigger ON public.landing_leads;
CREATE TRIGGER validate_landing_lead_trigger
  BEFORE INSERT ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_landing_lead();