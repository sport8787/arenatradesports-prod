-- 1) Recompensa BC por aposta virtual: bloqueia trapaça pós-kickoff e reduz valores
CREATE OR REPLACE FUNCTION public.credit_bc_for_virtual_bet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT;
  v_base INT := 3;
  v_bonus INT := 0;
  v_subtotal INT;
  v_total INT;
  v_plan TEXT;
  v_is_active BOOLEAN;
  v_mult NUMERIC := 1.0;
  v_odd NUMERIC;
  v_commence TIMESTAMPTZ;
  v_created TIMESTAMPTZ;
BEGIN
  IF NEW.result IS NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.result,'')) NOT IN ('won','green','win') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result THEN
    RETURN NEW;
  END IF;

  v_source := CASE TG_TABLE_NAME
    WHEN 'virtual_bets_punter' THEN 'virtual_bet_punter'
    WHEN 'virtual_bets_manual' THEN 'virtual_bet_manual'
    ELSE NULL
  END;
  IF v_source IS NULL THEN RETURN NEW; END IF;

  -- Anti-trapaça: BC só é creditado quando a aposta foi feita ANTES do kickoff.
  -- Sem commence_time, ou aposta criada após o início -> sem BC.
  v_commence := NEW.commence_time;
  v_created := COALESCE(NEW.created_at, now());
  IF v_commence IS NULL OR v_created >= v_commence THEN
    RETURN NEW;
  END IF;

  -- BC base por faixa de odd (reduzido)
  v_odd := COALESCE(NEW.odd, 0);
  v_base := CASE
    WHEN v_odd >= 4.00 THEN 25
    WHEN v_odd >= 3.00 THEN 18
    WHEN v_odd >= 2.30 THEN 12
    WHEN v_odd >= 1.90 THEN 8
    WHEN v_odd >= 1.60 THEN 5
    WHEN v_odd >= 1.30 THEN 3
    ELSE 3
  END;

  -- Bônus pequeno por lucro proporcional (cap 10 BC)
  IF NEW.stake IS NOT NULL AND NEW.stake > 0 AND NEW.profit_loss IS NOT NULL AND NEW.profit_loss > 0 THEN
    v_bonus := LEAST(10, FLOOR((NEW.profit_loss / NEW.stake) * 3)::INT);
  END IF;
  v_subtotal := v_base + v_bonus;

  SELECT plan, is_active INTO v_plan, v_is_active
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_plan = 'premium' AND COALESCE(v_is_active, false) THEN
    v_mult := 1.3;
  ELSIF v_plan = 'base' AND COALESCE(v_is_active, false) THEN
    v_mult := 1.1;
  ELSE
    v_mult := 1.0;
  END IF;

  v_total := FLOOR(v_subtotal * v_mult)::INT;

  BEGIN
    INSERT INTO public.bc_rewards_log
      (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, plan_at_credit)
    VALUES
      (NEW.user_id, NEW.id, v_source, v_base, v_bonus, v_total,
       'GREEN @' || v_odd::text || ' (' || COALESCE(NEW.market,'?') || ')'
         || CASE WHEN v_mult > 1 THEN ' x' || v_mult || ' ' || COALESCE(v_plan,'?') ELSE '' END,
       v_mult, v_plan);
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'credit_bc_for_virtual_bet erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2) Streak diário com cap fixo de 20 BC
CREATE OR REPLACE FUNCTION public.claim_daily_streak_bonus(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_streak_date date;
  v_current_streak integer;
  v_today date := CURRENT_DATE;
  v_bonus integer := 20;
  v_max_streak integer := 7;
BEGIN
  SELECT last_streak_date, daily_streak_count
  INTO v_last_streak_date, v_current_streak
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_last_streak_date = v_today THEN
    RETURN 0;
  END IF;

  IF v_last_streak_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := LEAST(COALESCE(v_current_streak,0) + 1, v_max_streak);
  ELSE
    v_current_streak := 1;
  END IF;

  -- Cap fixo: 20 BC por dia, independente da posição no streak.
  UPDATE profiles
  SET 
    last_streak_date = v_today,
    daily_streak_count = v_current_streak,
    bc_balance = bc_balance + v_bonus,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_bonus;
END;
$$;