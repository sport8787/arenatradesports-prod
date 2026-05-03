
-- 1) Adiciona colunas no log para auditoria de multiplicador
ALTER TABLE public.bc_rewards_log
  ADD COLUMN IF NOT EXISTS multiplier NUMERIC NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS plan_at_credit TEXT;

-- 2) Atualiza função de crédito BC com multiplicador por plano
CREATE OR REPLACE FUNCTION public.credit_bc_for_virtual_bet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT;
  v_base INT := 50;
  v_bonus INT := 0;
  v_subtotal INT;
  v_total INT;
  v_plan TEXT;
  v_is_active BOOLEAN;
  v_mult NUMERIC := 1.0;
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

  -- Bônus proporcional ao lucro
  IF NEW.stake IS NOT NULL AND NEW.stake > 0 AND NEW.profit_loss IS NOT NULL AND NEW.profit_loss > 0 THEN
    v_bonus := LEAST(450, FLOOR((NEW.profit_loss / NEW.stake) * 100)::INT);
  END IF;
  v_subtotal := v_base + v_bonus;

  -- Resolve plano ativo do usuário para multiplicador
  SELECT plan, is_active INTO v_plan, v_is_active
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_plan = 'premium' AND COALESCE(v_is_active, false) THEN
    v_mult := 2.0;
  ELSIF v_plan = 'base' AND COALESCE(v_is_active, false) THEN
    v_mult := 1.5;
  ELSE
    v_mult := 1.0;
  END IF;

  v_total := FLOOR(v_subtotal * v_mult)::INT;

  BEGIN
    INSERT INTO public.bc_rewards_log
      (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo, multiplier, plan_at_credit)
    VALUES
      (NEW.user_id, NEW.id, v_source, v_base, v_bonus, v_total,
       'Aposta virtual vencedora: ' || COALESCE(NEW.market,'?')
         || CASE WHEN v_mult > 1 THEN ' (x' || v_mult || ' ' || COALESCE(v_plan,'?') || ')' ELSE '' END,
       v_mult, v_plan);
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  UPDATE public.profiles
  SET bc_balance = bc_balance + v_total,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'credit_bc_for_virtual_bet erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Recria leaderboard com plano do usuário (para badge no frontend)
DROP VIEW IF EXISTS public.liga_mycroft_leaderboard;

CREATE VIEW public.liga_mycroft_leaderboard AS
WITH real_users AS (
  SELECT
    r.user_id::text AS row_key,
    r.user_id,
    NULL::uuid AS seed_id,
    false AS is_horus,
    false AS is_fake,
    CASE
      WHEN COALESCE(p.username, '') = '' THEN 'Trader***'
      ELSE LEFT(p.username, 3) || repeat('*', GREATEST(LEAST(LENGTH(p.username) - 3, 6), 1))
    END AS display_name,
    r.total_bets,
    r.greens,
    r.reds,
    r.total_staked,
    r.total_returned,
    r.roi_pct,
    COALESCE(us.plan, 'free') AS plan,
    COALESCE(us.is_active, false) AS plan_active
  FROM public.mycroft_user_roi r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  LEFT JOIN public.user_subscriptions us ON us.user_id = r.user_id
  WHERE r.total_bets >= 5
),
seed_users AS (
  SELECT
    'seed:' || s.id::text AS row_key,
    NULL::uuid AS user_id,
    s.id AS seed_id,
    s.is_horus,
    NOT s.is_horus AS is_fake,
    s.display_name,
    s.total_bets,
    s.greens,
    s.reds,
    s.total_staked,
    s.total_returned,
    ROUND(
      CASE WHEN s.total_staked > 0
        THEN ((s.total_returned - s.total_staked) / s.total_staked * 100)::numeric
        ELSE 0 END
    , 2) AS roi_pct,
    NULL::text AS plan,
    false AS plan_active
  FROM public.liga_mycroft_seed_users s
),
combined AS (
  SELECT * FROM real_users
  UNION ALL
  SELECT * FROM seed_users
)
SELECT
  row_key, user_id, seed_id, is_horus, is_fake,
  display_name, total_bets, greens, reds,
  total_staked, total_returned, roi_pct,
  plan, plan_active,
  RANK() OVER (ORDER BY roi_pct DESC, total_bets DESC) AS rank
FROM combined;
