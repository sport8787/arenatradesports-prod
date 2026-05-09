
-- ============================================================
-- 1) Tabela de cap mensal de BC
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bc_monthly_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- YYYY-MM
  total_credited integer NOT NULL DEFAULT 0,
  cap_at_period integer NOT NULL DEFAULT 600,
  plan_at_period text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_month)
);

ALTER TABLE public.bc_monthly_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monthly cap"
  ON public.bc_monthly_caps FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all monthly caps"
  ON public.bc_monthly_caps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) Expiração de BC: coluna em bc_rewards_log
-- ============================================================
ALTER TABLE public.bc_rewards_log
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.bc_rewards_log
SET expires_at = created_at + INTERVAL '120 days'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bc_rewards_log_expires
  ON public.bc_rewards_log (expires_at)
  WHERE expires_at IS NOT NULL;

-- Permitir source 'expiration' e 'red_penalty'
ALTER TABLE public.bc_rewards_log
  DROP CONSTRAINT IF EXISTS bc_rewards_log_source_check;
ALTER TABLE public.bc_rewards_log
  ADD CONSTRAINT bc_rewards_log_source_check
  CHECK (source = ANY (ARRAY[
    'virtual_bet_punter','virtual_bet_manual',
    'red_penalty_punter','red_penalty_manual',
    'expiration','daily_streak'
  ]));

-- ============================================================
-- 3) Função: crédito por GREEN (reescrita)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_bc_for_virtual_bet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_source TEXT;
  v_base INT := 0;
  v_bonus INT := 0;
  v_subtotal INT;
  v_total INT;
  v_plan TEXT;
  v_is_active BOOLEAN;
  v_trial_ends TIMESTAMPTZ;
  v_mult NUMERIC := 1.0;
  v_odd NUMERIC;
  v_commence TIMESTAMPTZ;
  v_created TIMESTAMPTZ;
  v_asset_score NUMERIC;
  v_discipline_factor NUMERIC := 1.0;
  v_ym TEXT := to_char(now(),'YYYY-MM');
  v_cap INT := 600;
  v_already INT := 0;
  v_remaining INT;
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

  -- Anti-trapaça: aposta antes do kickoff
  v_commence := NEW.commence_time;
  v_created := COALESCE(NEW.created_at, now());
  IF v_commence IS NULL OR v_created >= v_commence THEN
    RETURN NEW;
  END IF;

  -- BC base por faixa de odd (rebalanceado, -40%)
  v_odd := COALESCE(NEW.odd, 0);
  v_base := CASE
    WHEN v_odd >= 4.00 THEN 15
    WHEN v_odd >= 3.00 THEN 11
    WHEN v_odd >= 2.30 THEN 7
    WHEN v_odd >= 1.90 THEN 5
    WHEN v_odd >= 1.60 THEN 3
    ELSE 0
  END;
  IF v_base = 0 THEN RETURN NEW; END IF;

  -- Bônus pequeno por lucro proporcional (cap 5 BC)
  IF NEW.stake IS NOT NULL AND NEW.stake > 0 AND NEW.profit_loss IS NOT NULL AND NEW.profit_loss > 0 THEN
    v_bonus := LEAST(5, FLOOR((NEW.profit_loss / NEW.stake) * 2)::INT);
  END IF;

  -- Bônus de disciplina: aposta vinda de sinal de qualidade boa = full;
  -- aposta manual sem sinal = 50% (incentiva seguir a recomendação)
  v_asset_score := NEW.asset_score;
  IF v_asset_score IS NULL OR v_asset_score < 50 THEN
    v_discipline_factor := 0.5;
  END IF;

  v_subtotal := FLOOR((v_base + v_bonus) * v_discipline_factor)::INT;
  IF v_subtotal <= 0 THEN RETURN NEW; END IF;

  -- Multiplicador por plano (com boost para trial)
  SELECT plan, is_active, trial_ends_at
  INTO v_plan, v_is_active, v_trial_ends
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_plan = 'premium' AND COALESCE(v_is_active,false) THEN
    v_mult := 1.3; v_cap := 2000;
  ELSIF v_plan = 'base' AND COALESCE(v_is_active,false) THEN
    v_mult := 1.1; v_cap := 1200;
  ELSIF v_plan = 'trial' AND COALESCE(v_is_active,false)
        AND v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
    -- Trial ATIVO: boost generoso para criar percepção de progresso rápido.
    -- Resgate fica bloqueado em outra camada (vitrine).
    v_mult := 2.5; v_cap := 600;
  ELSE
    v_mult := 1.0; v_cap := 600;
  END IF;

  v_total := FLOOR(v_subtotal * v_mult)::INT;
  IF v_total <= 0 THEN RETURN NEW; END IF;

  -- Cap mensal: nunca crédito além do que falta no mês
  SELECT COALESCE(total_credited,0) INTO v_already
  FROM public.bc_monthly_caps
  WHERE user_id = NEW.user_id AND year_month = v_ym;

  v_remaining := v_cap - COALESCE(v_already,0);
  IF v_remaining <= 0 THEN RETURN NEW; END IF;
  v_total := LEAST(v_total, v_remaining);

  BEGIN
    INSERT INTO public.bc_rewards_log
      (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, plan_at_credit, expires_at)
    VALUES
      (NEW.user_id, NEW.id, v_source, v_base, v_bonus, v_total,
       'GREEN @' || v_odd::text || ' (' || COALESCE(NEW.market,'?') || ')'
         || CASE WHEN v_discipline_factor < 1 THEN ' [manual 50%]' ELSE '' END
         || CASE WHEN v_mult <> 1 THEN ' x' || v_mult || ' ' || COALESCE(v_plan,'?') ELSE '' END,
       v_mult, v_plan, now() + INTERVAL '120 days');
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  -- Atualiza cap
  INSERT INTO public.bc_monthly_caps (user_id, year_month, total_credited, cap_at_period, plan_at_period)
  VALUES (NEW.user_id, v_ym, v_total, v_cap, v_plan)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET
    total_credited = public.bc_monthly_caps.total_credited + EXCLUDED.total_credited,
    cap_at_period = EXCLUDED.cap_at_period,
    plan_at_period = EXCLUDED.plan_at_period,
    updated_at = now();

  -- Credita saldo
  UPDATE public.profiles
  SET bc_balance = COALESCE(bc_balance,0) + v_total, updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'credit_bc_for_virtual_bet erro: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 4) Penalidade por RED (debita 3 BC, mínimo 0)
-- ============================================================
CREATE OR REPLACE FUNCTION public.debit_bc_for_red_bet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_source TEXT;
  v_penalty INT := 3;
  v_current INT;
BEGIN
  IF NEW.result IS NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.result,'')) NOT IN ('lost','red','loss') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result THEN
    RETURN NEW;
  END IF;

  v_source := CASE TG_TABLE_NAME
    WHEN 'virtual_bets_punter' THEN 'red_penalty_punter'
    WHEN 'virtual_bets_manual' THEN 'red_penalty_manual'
    ELSE NULL
  END;
  IF v_source IS NULL THEN RETURN NEW; END IF;

  -- Idempotência via unique (bet_id, source)
  BEGIN
    INSERT INTO public.bc_rewards_log
      (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, expires_at)
    VALUES
      (NEW.user_id, NEW.id, v_source, 0, 0, -v_penalty,
       'RED @' || COALESCE(NEW.odd,0)::text || ' (' || COALESCE(NEW.market,'?') || ')',
       1.0, NULL);
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  SELECT COALESCE(bc_balance,0) INTO v_current FROM public.profiles WHERE user_id = NEW.user_id;
  UPDATE public.profiles
  SET bc_balance = GREATEST(0, COALESCE(bc_balance,0) - v_penalty), updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'debit_bc_for_red_bet erro: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bc_red_punter ON public.virtual_bets_punter;
CREATE TRIGGER trg_bc_red_punter
AFTER INSERT OR UPDATE OF result ON public.virtual_bets_punter
FOR EACH ROW EXECUTE FUNCTION public.debit_bc_for_red_bet();

DROP TRIGGER IF EXISTS trg_bc_red_manual ON public.virtual_bets_manual;
CREATE TRIGGER trg_bc_red_manual
AFTER INSERT OR UPDATE OF result ON public.virtual_bets_manual
FOR EACH ROW EXECUTE FUNCTION public.debit_bc_for_red_bet();

-- ============================================================
-- 5) Streak diário: 10 BC, exige 1+ aposta no dia
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_streak_bonus(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_streak_date date;
  v_current_streak integer;
  v_today date := CURRENT_DATE;
  v_bonus integer := 10;
  v_max_streak integer := 7;
  v_has_bet_today boolean := false;
BEGIN
  SELECT last_streak_date, daily_streak_count
  INTO v_last_streak_date, v_current_streak
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_last_streak_date = v_today THEN
    RETURN 0;
  END IF;

  -- Exige ao menos 1 aposta virtual hoje (em qualquer das duas tabelas)
  SELECT EXISTS (
    SELECT 1 FROM public.virtual_bets_punter
    WHERE user_id = p_user_id AND created_at::date = v_today
    UNION ALL
    SELECT 1 FROM public.virtual_bets_manual
    WHERE user_id = p_user_id AND created_at::date = v_today
  ) INTO v_has_bet_today;

  IF NOT v_has_bet_today THEN
    RETURN 0;
  END IF;

  IF v_last_streak_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := LEAST(COALESCE(v_current_streak,0) + 1, v_max_streak);
  ELSE
    v_current_streak := 1;
  END IF;

  UPDATE profiles
  SET
    last_streak_date = v_today,
    daily_streak_count = v_current_streak,
    bc_balance = COALESCE(bc_balance,0) + v_bonus,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log para auditoria/expiração
  BEGIN
    INSERT INTO public.bc_rewards_log
      (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, expires_at)
    VALUES
      (p_user_id, gen_random_uuid(), 'daily_streak', v_bonus, 0, v_bonus,
       'Streak diário dia ' || v_current_streak, 1.0, now() + INTERVAL '120 days');
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  RETURN v_bonus;
END;
$function$;

-- ============================================================
-- 6) Função de expiração diária (FIFO)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_old_bc_rewards()
RETURNS TABLE(users_affected int, total_expired bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_users INT := 0;
  v_total BIGINT := 0;
BEGIN
  FOR rec IN
    SELECT user_id, SUM(total_bc)::bigint AS to_expire
    FROM public.bc_rewards_log
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND total_bc > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.bc_rewards_log e
        WHERE e.source = 'expiration'
          AND e.bet_id = bc_rewards_log.id
      )
    GROUP BY user_id
  LOOP
    UPDATE public.profiles
    SET bc_balance = GREATEST(0, COALESCE(bc_balance,0) - rec.to_expire), updated_at = now()
    WHERE user_id = rec.user_id;

    -- Marca lotes expirados criando 1 log negativo por lote
    INSERT INTO public.bc_rewards_log (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, expires_at)
    SELECT user_id, id, 'expiration', 0, 0, -total_bc,
           'Expirou após 120 dias', 1.0, NULL
    FROM public.bc_rewards_log
    WHERE user_id = rec.user_id
      AND expires_at IS NOT NULL
      AND expires_at <= now()
      AND total_bc > 0
    ON CONFLICT (bet_id, source) DO NOTHING;

    v_users := v_users + 1;
    v_total := v_total + rec.to_expire;
  END LOOP;

  RETURN QUERY SELECT v_users, v_total;
END;
$function$;
