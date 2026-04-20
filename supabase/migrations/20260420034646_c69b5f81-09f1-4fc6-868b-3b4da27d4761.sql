CREATE TABLE public.promo_slots (
  id TEXT PRIMARY KEY DEFAULT 'launch_2025',
  slots_total INTEGER NOT NULL DEFAULT 200,
  slots_remaining INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  campaign_name TEXT NOT NULL DEFAULT 'Lançamento Mycroft 2025',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slots_remaining_non_negative CHECK (slots_remaining >= 0),
  CONSTRAINT slots_remaining_lte_total CHECK (slots_remaining <= slots_total)
);

ALTER TABLE public.promo_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_slots_public_read"
ON public.promo_slots FOR SELECT
USING (true);

CREATE TABLE public.promo_slot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id TEXT NOT NULL REFERENCES public.promo_slots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'drift', 'manual')),
  slots_before INTEGER NOT NULL,
  slots_after INTEGER NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_slot_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_promo_slot_events_promo_created
  ON public.promo_slot_events (promo_id, created_at DESC);

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

  UPDATE public.promo_slots
  SET slots_remaining = GREATEST(slots_remaining - 1, 0),
      is_active = (slots_remaining - 1 > 0),
      updated_at = now()
  WHERE id = p_promo_id
    AND is_active = true
    AND slots_remaining > 0
  RETURNING slots_remaining + 1, slots_remaining, slots_total, is_active
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

INSERT INTO public.promo_slots (id, slots_total, slots_remaining)
VALUES ('launch_2025', 200, 200)
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_slots;

CREATE TRIGGER trg_promo_slots_updated_at
  BEFORE UPDATE ON public.promo_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT cron.schedule(
  'promo-slots-drift',
  '*/20 12-23,0-2 * * *',
  $$
  SELECT public.decrement_promo_slot('launch_2025', 'drift', 'cron-drift', NULL)
  WHERE random() < 0.5
    AND (SELECT slots_remaining FROM public.promo_slots WHERE id = 'launch_2025') > 20;
  $$
);