CREATE OR REPLACE FUNCTION public.validate_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan NOT IN ('trial', 'starter', 'basic', 'base', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', NEW.plan;
  END IF;
  RETURN NEW;
END;
$function$;