
-- ===== Hórus Pilota: automação do Método dos Ciclos =====

-- 1) Colunas novas na banca de ciclo
ALTER TABLE public.user_cycles_bankroll
  ADD COLUMN IF NOT EXISTS horus_pilot_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horus_pilot_mode TEXT NOT NULL DEFAULT 'simulated'
    CHECK (horus_pilot_mode IN ('assisted','simulated')),
  ADD COLUMN IF NOT EXISTS independent_bankroll BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consecutive_reds INTEGER NOT NULL DEFAULT 0;

-- 2) Helper interno (chamável por trigger): registra entrada para um user_id arbitrário
CREATE OR REPLACE FUNCTION public._register_cycle_entry_for_user(
  p_user_id UUID,
  p_result TEXT,
  p_profit_loss NUMERIC,
  p_match_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bk public.user_cycles_bankroll;
  v_target_pct NUMERIC;
  v_target_amount NUMERIC;
  v_new_balance NUMERIC;
  v_new_green INTEGER;
  v_cycle_goal NUMERIC;
  v_completed BOOLEAN := false;
  v_failed BOOLEAN := false;
  v_new_reds INTEGER;
  v_paused BOOLEAN := false;
BEGIN
  IF p_result NOT IN ('green','red','void') THEN RAISE EXCEPTION 'result inválido'; END IF;

  SELECT * INTO bk FROM public.user_cycles_bankroll WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;
  IF bk.status <> 'active' THEN RAISE EXCEPTION 'ciclo não está ativo (status=%)', bk.status; END IF;

  v_target_pct := round((5.0 * power(0.975, bk.green_streak))::numeric, 4);
  v_target_amount := round((bk.current_stake * v_target_pct / 100.0)::numeric, 2);

  IF p_result = 'green' THEN
    v_new_balance := bk.current_balance + abs(p_profit_loss);
    v_new_green := bk.green_streak + 1;
    v_new_reds := 0;
  ELSIF p_result = 'red' THEN
    v_new_balance := bk.current_balance - abs(p_profit_loss);
    v_new_green := 0;
    v_new_reds := bk.consecutive_reds + 1;
    IF v_new_balance <= 0 THEN v_failed := true; v_new_balance := 0; END IF;
  ELSE
    v_new_balance := bk.current_balance;
    v_new_green := bk.green_streak;
    v_new_reds := bk.consecutive_reds;
  END IF;

  v_cycle_goal := bk.current_stake * 2.0;
  IF v_new_balance >= v_cycle_goal AND NOT v_failed THEN
    v_completed := true;
  END IF;

  -- Auto-pausa após 2 REDs consecutivos (apenas se pilot ativo)
  IF bk.horus_pilot_enabled AND v_new_reds >= 2 THEN
    v_paused := true;
  END IF;

  INSERT INTO public.user_cycles_entries(
    user_id, cycle_number, entry_index, target_pct, target_amount,
    result, profit_loss, balance_after, match_id, note
  ) VALUES (
    p_user_id, bk.current_cycle, bk.entries_in_cycle + 1, v_target_pct, v_target_amount,
    p_result, COALESCE(p_profit_loss,0), v_new_balance, p_match_id, p_note
  );

  UPDATE public.user_cycles_bankroll SET
    current_balance = v_new_balance,
    entries_in_cycle = entries_in_cycle + 1,
    green_streak = v_new_green,
    consecutive_reds = v_new_reds,
    auto_paused = CASE WHEN v_paused THEN true ELSE auto_paused END,
    status = CASE
      WHEN v_failed THEN 'failed'
      WHEN v_completed THEN 'awaiting_withdrawal'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'completed', v_completed,
    'failed', v_failed,
    'paused', v_paused,
    'new_balance', v_new_balance,
    'target_pct', v_target_pct,
    'target_amount', v_target_amount,
    'cycle_goal', v_cycle_goal
  );
END;
$$;

-- 3) RPC público register_cycle_entry usa helper
CREATE OR REPLACE FUNCTION public.register_cycle_entry(
  p_result TEXT,
  p_profit_loss NUMERIC,
  p_match_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  RETURN public._register_cycle_entry_for_user(uid, p_result, p_profit_loss, p_match_id, p_note);
END;
$$;

-- 4) Iniciar Hórus Pilota com banca independente (default R$ 200)
CREATE OR REPLACE FUNCTION public.start_horus_pilot_cycle(
  p_bankroll NUMERIC DEFAULT 200,
  p_mode TEXT DEFAULT 'simulated'
)
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_bankroll <= 0 THEN RAISE EXCEPTION 'banca inválida'; END IF;
  IF p_mode NOT IN ('assisted','simulated') THEN RAISE EXCEPTION 'modo inválido'; END IF;

  INSERT INTO public.user_cycles_bankroll (
    user_id, total_bankroll, isolated_pct, initial_bankroll,
    current_cycle, current_stake, current_balance, entries_in_cycle,
    green_streak, status, total_withdrawn,
    horus_pilot_enabled, horus_pilot_mode, independent_bankroll,
    auto_paused, consecutive_reds
  ) VALUES (
    uid, p_bankroll, 100, p_bankroll, 1, p_bankroll, p_bankroll, 0, 0, 'active', 0,
    true, p_mode, true, false, 0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_bankroll = EXCLUDED.total_bankroll,
    isolated_pct = 100,
    initial_bankroll = EXCLUDED.initial_bankroll,
    current_cycle = 1,
    current_stake = EXCLUDED.current_stake,
    current_balance = EXCLUDED.current_balance,
    entries_in_cycle = 0,
    green_streak = 0,
    status = 'active',
    total_withdrawn = 0,
    horus_pilot_enabled = true,
    horus_pilot_mode = EXCLUDED.horus_pilot_mode,
    independent_bankroll = true,
    auto_paused = false,
    consecutive_reds = 0,
    updated_at = now()
  RETURNING * INTO row;

  DELETE FROM public.user_cycles_entries WHERE user_id = uid;
  RETURN row;
END;
$$;

-- 5) Toggle Hórus Pilota (sem reset, só liga/desliga + muda modo)
CREATE OR REPLACE FUNCTION public.toggle_horus_pilot(
  p_enabled BOOLEAN,
  p_mode TEXT DEFAULT NULL
)
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_mode IS NOT NULL AND p_mode NOT IN ('assisted','simulated') THEN
    RAISE EXCEPTION 'modo inválido';
  END IF;

  UPDATE public.user_cycles_bankroll SET
    horus_pilot_enabled = p_enabled,
    horus_pilot_mode = COALESCE(p_mode, horus_pilot_mode),
    auto_paused = CASE WHEN p_enabled THEN false ELSE auto_paused END,
    consecutive_reds = CASE WHEN p_enabled THEN 0 ELSE consecutive_reds END,
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;
  RETURN row;
END;
$$;

-- 6) Resume após auto-pausa
CREATE OR REPLACE FUNCTION public.resume_horus_pilot()
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.user_cycles_bankroll SET
    auto_paused = false,
    consecutive_reds = 0,
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;
  RETURN row;
END;
$$;

-- 7) Detecta se um market string é Match Odds (1X2)
CREATE OR REPLACE FUNCTION public.is_match_odds_market(p_market TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_market ~* '^(vit[óo]ria |casa$|fora$|empate$|1x2$|draw$|home$|away$|match[_ ]?winner|match[_ ]?odds)'
$$;

-- 8) Trigger: auto-vincula liquidação Punter Match Odds ao ciclo
CREATE OR REPLACE FUNCTION public.trg_horus_pilot_autobind()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bk public.user_cycles_bankroll;
  v_result TEXT;
  v_pl NUMERIC;
BEGIN
  -- Só age em transição pending → green/red
  IF NEW.status NOT IN ('green','red') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NOT public.is_match_odds_market(NEW.market) THEN RETURN NEW; END IF;

  SELECT * INTO bk FROM public.user_cycles_bankroll WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT bk.horus_pilot_enabled OR bk.auto_paused OR bk.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_result := NEW.status;
  IF v_result = 'green' THEN
    v_pl := COALESCE(NEW.stake,0) * (COALESCE(NEW.odd,1) - 1);
  ELSE
    v_pl := COALESCE(NEW.stake,0);
  END IF;

  BEGIN
    PERFORM public._register_cycle_entry_for_user(
      NEW.user_id,
      v_result,
      v_pl,
      NEW.match_id,
      'Auto-vinculado por Hórus Pilota (' || bk.horus_pilot_mode || ')'
    );
  EXCEPTION WHEN OTHERS THEN
    -- não bloqueia liquidação
    RAISE WARNING 'horus_pilot_autobind falhou user=% match=%: %', NEW.user_id, NEW.match_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_horus_pilot_autobind ON public.virtual_bets_punter;
CREATE TRIGGER trg_horus_pilot_autobind
AFTER UPDATE OF status ON public.virtual_bets_punter
FOR EACH ROW EXECUTE FUNCTION public.trg_horus_pilot_autobind();
