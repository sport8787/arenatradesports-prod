CREATE OR REPLACE FUNCTION public.decrement_promo_slot(
  p_promo_id TEXT DEFAULT 'launch_2025',
  p_event_type TEXT DEFAULT 'click',
  p_user_agent TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL
)
RETURNS TABLE (slots_remaining INTEGER, slots_total INTEGER, is_active BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
  v_total INTEGER;
  v_active BOOLEAN;
BEGIN
  IF p_event_type NOT IN ('click','drift','manual') THEN
    RAISE EXCEPTION 'Invalid event_type: %', p_event_type;
  END IF;

  UPDATE public.promo_slots ps
  SET slots_remaining = GREATEST(ps.slots_remaining - 1, 0),
      is_active = (ps.slots_remaining - 1 > 0),
      updated_at = now()
  WHERE ps.id = p_promo_id
    AND ps.is_active = true
    AND ps.slots_remaining > 0
  RETURNING ps.slots_remaining + 1, ps.slots_remaining, ps.slots_total, ps.is_active
    INTO v_before, v_after, v_total, v_active;

  IF NOT FOUND THEN
    SELECT ps.slots_remaining, ps.slots_total, ps.is_active
    INTO v_after, v_total, v_active
    FROM public.promo_slots ps
    WHERE ps.id = p_promo_id;
    RETURN QUERY SELECT v_after, v_total, v_active;
    RETURN;
  END IF;

  INSERT INTO public.promo_slot_events (promo_id, event_type, slots_before, slots_after, user_agent, ip_hash)
  VALUES (p_promo_id, p_event_type, v_before, v_after, p_user_agent, p_ip_hash);

  RETURN QUERY SELECT v_after, v_total, v_active;
END;
$$;