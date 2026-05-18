
-- Tabela banca de ciclo (1 por usuário)
CREATE TABLE public.user_cycles_bankroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  total_bankroll NUMERIC NOT NULL CHECK (total_bankroll > 0),
  isolated_pct NUMERIC NOT NULL CHECK (isolated_pct > 0 AND isolated_pct <= 100),
  initial_bankroll NUMERIC NOT NULL CHECK (initial_bankroll > 0),
  current_cycle INTEGER NOT NULL DEFAULT 1 CHECK (current_cycle BETWEEN 1 AND 5),
  current_stake NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  entries_in_cycle INTEGER NOT NULL DEFAULT 0,
  green_streak INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','awaiting_withdrawal')),
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_cycles_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL,
  entry_index INTEGER NOT NULL,
  target_pct NUMERIC NOT NULL,
  target_amount NUMERIC NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('green','red','void')),
  profit_loss NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL,
  match_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cycles_entries_user ON public.user_cycles_entries(user_id, created_at DESC);

ALTER TABLE public.user_cycles_bankroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cycles_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycles_bankroll_owner_all" ON public.user_cycles_bankroll
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cycles_entries_owner_all" ON public.user_cycles_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER trg_cycles_bankroll_updated
BEFORE UPDATE ON public.user_cycles_bankroll
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: configuração de cada ciclo proporcional à banca inicial B
-- Ciclo 1: stake=B,   meta=2B, saque=B
-- Ciclo 2: stake=B,   meta=2B, saque=B
-- Ciclo 3: stake=1.5B,meta=3B, saque=0.5B
-- Ciclo 4: stake=2B,  meta=4B, saque=B
-- Ciclo 5: stake=3B,  meta=6B, saque=0 (fim)
CREATE OR REPLACE FUNCTION public.cycle_stake_for(b NUMERIC, n INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE n
    WHEN 1 THEN b
    WHEN 2 THEN b
    WHEN 3 THEN b * 1.5
    WHEN 4 THEN b * 2.0
    WHEN 5 THEN b * 3.0
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.cycle_withdraw_for(b NUMERIC, n INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE n
    WHEN 1 THEN b
    WHEN 2 THEN b
    WHEN 3 THEN b * 0.5
    WHEN 4 THEN b
    ELSE 0
  END;
$$;

-- Iniciar método
CREATE OR REPLACE FUNCTION public.start_cycle_method(p_total NUMERIC, p_pct NUMERIC)
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  b NUMERIC := round((p_total * p_pct / 100.0)::numeric, 2);
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_pct > 10 THEN RAISE EXCEPTION 'isolated_pct máximo 10%% (recomendação Nettuno)'; END IF;
  IF b <= 0 THEN RAISE EXCEPTION 'banca inicial inválida'; END IF;

  INSERT INTO public.user_cycles_bankroll (
    user_id, total_bankroll, isolated_pct, initial_bankroll,
    current_cycle, current_stake, current_balance, entries_in_cycle,
    green_streak, status, total_withdrawn
  ) VALUES (
    uid, p_total, p_pct, b, 1, b, b, 0, 0, 'active', 0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_bankroll = EXCLUDED.total_bankroll,
    isolated_pct = EXCLUDED.isolated_pct,
    initial_bankroll = EXCLUDED.initial_bankroll,
    current_cycle = 1,
    current_stake = EXCLUDED.current_stake,
    current_balance = EXCLUDED.current_balance,
    entries_in_cycle = 0,
    green_streak = 0,
    status = 'active',
    total_withdrawn = 0,
    updated_at = now()
  RETURNING * INTO row;

  -- limpa entradas antigas em reinício
  DELETE FROM public.user_cycles_entries WHERE user_id = uid;

  RETURN row;
END;
$$;

-- Registrar entrada (green/red/void)
-- target_pct é calculado: 5% * (1 - 0.025)^green_streak
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
  bk public.user_cycles_bankroll;
  v_target_pct NUMERIC;
  v_target_amount NUMERIC;
  v_new_balance NUMERIC;
  v_new_green INTEGER;
  v_cycle_goal NUMERIC;
  v_completed BOOLEAN := false;
  v_failed BOOLEAN := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_result NOT IN ('green','red','void') THEN RAISE EXCEPTION 'result inválido'; END IF;

  SELECT * INTO bk FROM public.user_cycles_bankroll WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;
  IF bk.status <> 'active' THEN RAISE EXCEPTION 'ciclo não está ativo (status=%)', bk.status; END IF;

  v_target_pct := round((5.0 * power(0.975, bk.green_streak))::numeric, 4);
  v_target_amount := round((bk.current_stake * v_target_pct / 100.0)::numeric, 2);

  IF p_result = 'green' THEN
    v_new_balance := bk.current_balance + abs(p_profit_loss);
    v_new_green := bk.green_streak + 1;
  ELSIF p_result = 'red' THEN
    v_new_balance := bk.current_balance - abs(p_profit_loss);
    v_new_green := 0;
    IF v_new_balance <= 0 THEN v_failed := true; v_new_balance := 0; END IF;
  ELSE
    v_new_balance := bk.current_balance;
    v_new_green := bk.green_streak;
  END IF;

  -- Meta do ciclo = dobrar a stake de trabalho
  v_cycle_goal := bk.current_stake * 2.0;
  IF v_new_balance >= v_cycle_goal AND NOT v_failed THEN
    v_completed := true;
  END IF;

  INSERT INTO public.user_cycles_entries(
    user_id, cycle_number, entry_index, target_pct, target_amount,
    result, profit_loss, balance_after, match_id, note
  ) VALUES (
    uid, bk.current_cycle, bk.entries_in_cycle + 1, v_target_pct, v_target_amount,
    p_result, COALESCE(p_profit_loss,0), v_new_balance, p_match_id, p_note
  );

  UPDATE public.user_cycles_bankroll SET
    current_balance = v_new_balance,
    entries_in_cycle = entries_in_cycle + 1,
    green_streak = v_new_green,
    status = CASE
      WHEN v_failed THEN 'failed'
      WHEN v_completed THEN 'awaiting_withdrawal'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'completed', v_completed,
    'failed', v_failed,
    'new_balance', v_new_balance,
    'target_pct', v_target_pct,
    'target_amount', v_target_amount,
    'cycle_goal', v_cycle_goal
  );
END;
$$;

-- Avançar para próximo ciclo (após saque)
CREATE OR REPLACE FUNCTION public.advance_cycle()
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  bk public.user_cycles_bankroll;
  v_withdraw NUMERIC;
  v_next INTEGER;
  v_next_stake NUMERIC;
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO bk FROM public.user_cycles_bankroll WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;
  IF bk.status <> 'awaiting_withdrawal' THEN RAISE EXCEPTION 'ciclo não está aguardando saque'; END IF;

  v_withdraw := cycle_withdraw_for(bk.initial_bankroll, bk.current_cycle);
  v_next := bk.current_cycle + 1;

  IF v_next > 5 THEN
    UPDATE public.user_cycles_bankroll SET
      status = 'completed',
      total_withdrawn = total_withdrawn + bk.current_balance,
      current_balance = 0,
      updated_at = now()
    WHERE user_id = uid RETURNING * INTO row;
    RETURN row;
  END IF;

  v_next_stake := cycle_stake_for(bk.initial_bankroll, v_next);

  UPDATE public.user_cycles_bankroll SET
    current_cycle = v_next,
    current_stake = v_next_stake,
    current_balance = v_next_stake,
    entries_in_cycle = 0,
    green_streak = 0,
    status = 'active',
    total_withdrawn = total_withdrawn + v_withdraw,
    updated_at = now()
  WHERE user_id = uid RETURNING * INTO row;

  RETURN row;
END;
$$;

-- Reiniciar (após failed ou manualmente)
CREATE OR REPLACE FUNCTION public.reset_cycle_method()
RETURNS public.user_cycles_bankroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  bk public.user_cycles_bankroll;
  row public.user_cycles_bankroll;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO bk FROM public.user_cycles_bankroll WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'método não iniciado'; END IF;

  UPDATE public.user_cycles_bankroll SET
    current_cycle = 1,
    current_stake = bk.initial_bankroll,
    current_balance = bk.initial_bankroll,
    entries_in_cycle = 0,
    green_streak = 0,
    status = 'active',
    total_withdrawn = 0,
    updated_at = now()
  WHERE user_id = uid RETURNING * INTO row;

  DELETE FROM public.user_cycles_entries WHERE user_id = uid;

  RETURN row;
END;
$$;
