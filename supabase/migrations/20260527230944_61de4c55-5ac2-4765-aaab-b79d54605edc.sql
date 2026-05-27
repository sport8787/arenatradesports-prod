
-- Ajuste do trigger Hórus Ciclos: usar P/L real conforme cashout_odd
-- (saída no lucro-alvo do método, não na odd cheia).
CREATE OR REPLACE FUNCTION public._horus_pilot_autobind_trader_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bk RECORD;
  v_pl NUMERIC;
  v_entry_odd NUMERIC;
  v_exit_odd NUMERIC;
  v_note TEXT;
  v_reds INT;
BEGIN
  IF NEW.via_horus_ciclos IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('green', 'red') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT *
    INTO bk
    FROM public.user_cycles_bankroll
   WHERE user_id = NEW.user_id
     AND horus_pilot_enabled = true
     AND COALESCE(auto_paused, false) = false
     AND status = 'active'
   LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_entry_odd := COALESCE(NEW.entry_odd, NEW.odd, 1);
  v_exit_odd  := COALESCE(NEW.cashout_odd, NEW.odd, v_entry_odd);

  IF NEW.status = 'green' THEN
    -- BACK: lucro = stake * (entry_odd/exit_odd - 1) — saída antecipada no target
    -- Se cashout_odd não veio (settlement por FT), cai pra stake*(odd-1)
    IF NEW.cashout_odd IS NOT NULL AND v_exit_odd > 0 THEN
      v_pl := COALESCE(NEW.stake, 0) * ((v_entry_odd / v_exit_odd) - 1);
    ELSE
      v_pl := COALESCE(NEW.stake, 0) * (v_entry_odd - 1);
    END IF;
    v_note := 'Hórus Ciclos · GREEN · ' || COALESCE(NEW.market, '') ||
              ' · entry=' || v_entry_odd::text || ' · exit=' || v_exit_odd::text;
  ELSE
    -- RED: respeita cashout_value (saída parcial) se houver; senão perde stake cheio
    IF NEW.cashout_value IS NOT NULL THEN
      v_pl := -1 * GREATEST(0, COALESCE(NEW.stake, 0) - COALESCE(NEW.cashout_value, 0));
    ELSE
      v_pl := -1 * COALESCE(NEW.stake, 0);
    END IF;
    v_note := 'Hórus Ciclos · RED · ' || COALESCE(NEW.market, '');
  END IF;

  PERFORM public._register_cycle_entry_for_user(
    NEW.user_id, NEW.status, v_pl, NEW.match_id, v_note
  );

  IF NEW.status = 'red' THEN
    SELECT consecutive_reds INTO v_reds
      FROM public.user_cycles_bankroll
     WHERE user_id = NEW.user_id;
    IF COALESCE(v_reds, 0) >= 2 THEN
      UPDATE public.user_cycles_bankroll
         SET auto_paused = true, updated_at = now()
       WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Índice para o monitor varrer rápido
CREATE INDEX IF NOT EXISTS idx_virtual_bets_horus_ciclos_pending
  ON public.virtual_bets(user_id, status)
  WHERE via_horus_ciclos = true AND status = 'pending';
