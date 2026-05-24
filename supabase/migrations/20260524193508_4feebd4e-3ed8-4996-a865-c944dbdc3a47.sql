CREATE OR REPLACE FUNCTION public.delete_cycle_method()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  DELETE FROM public.user_cycles_entries WHERE user_id = uid;
  DELETE FROM public.user_cycles_bankroll WHERE user_id = uid;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_cycle_method() TO authenticated;