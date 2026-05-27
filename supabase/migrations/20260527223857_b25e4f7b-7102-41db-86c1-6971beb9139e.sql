-- 1. Marcação para distinguir bets do método dos ciclos
ALTER TABLE public.virtual_bets
  ADD COLUMN IF NOT EXISTS via_horus_ciclos BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_virtual_bets_horus_ciclos_pending
  ON public.virtual_bets(user_id, status)
  WHERE via_horus_ciclos = true;

-- 2. Trigger function: liquidação de bet ciclo → registra entrada no método
CREATE OR REPLACE FUNCTION public._horus_pilot_autobind_trader_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bk RECORD;
  v_pl NUMERIC;
  v_note TEXT;
  v_reds INT;
BEGIN
  -- Só processa se virou green/red e veio do método dos ciclos
  IF NEW.via_horus_ciclos IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('green', 'red') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Confere se o usuário ainda tem o piloto ativo
  SELECT *
    INTO bk
    FROM public.user_cycles_bankroll
   WHERE user_id = NEW.user_id
     AND horus_pilot_enabled = true
     AND COALESCE(auto_paused, false) = false
     AND status = 'active'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calcula P/L em cima do stake real da bet (que é bk.current_stake no momento da entrada)
  IF NEW.status = 'green' THEN
    v_pl := COALESCE(NEW.stake, 0) * (COALESCE(NEW.odd, 1) - 1);
    v_note := 'Hórus Ciclos · TraderSports · GREEN · ' || COALESCE(NEW.market, '');
  ELSE
    v_pl := -1 * COALESCE(NEW.stake, 0);
    v_note := 'Hórus Ciclos · TraderSports · RED · ' || COALESCE(NEW.market, '');
  END IF;

  -- Delegar para a função interna existente (atualiza balance/streak/status)
  PERFORM public._register_cycle_entry_for_user(
    NEW.user_id,
    NEW.status,
    v_pl,
    NEW.match_id,
    v_note
  );

  -- Auto-pausa após 2 reds consecutivos
  IF NEW.status = 'red' THEN
    SELECT consecutive_reds INTO v_reds
      FROM public.user_cycles_bankroll
     WHERE user_id = NEW.user_id;

    IF COALESCE(v_reds, 0) >= 2 THEN
      UPDATE public.user_cycles_bankroll
         SET auto_paused = true,
             updated_at = now()
       WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_horus_pilot_autobind_trader ON public.virtual_bets;
CREATE TRIGGER trg_horus_pilot_autobind_trader
AFTER UPDATE OF status ON public.virtual_bets
FOR EACH ROW
EXECUTE FUNCTION public._horus_pilot_autobind_trader_trg();