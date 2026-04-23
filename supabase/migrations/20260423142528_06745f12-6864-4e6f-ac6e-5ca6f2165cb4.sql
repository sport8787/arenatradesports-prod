CREATE OR REPLACE FUNCTION public.tg_decrement_promo_on_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promo_slots
  SET slots_remaining = GREATEST(slots_remaining - 1, 0),
      is_active = (slots_remaining - 1 > 0)
  WHERE id = 'launch_2025' AND is_active = true AND slots_remaining > 0;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_promo_on_new_profile ON public.profiles;
CREATE TRIGGER trg_decrement_promo_on_new_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_decrement_promo_on_new_profile();