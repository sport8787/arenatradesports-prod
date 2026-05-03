
-- 1) Tabela de log de recompensas BC
CREATE TABLE IF NOT EXISTS public.bc_rewards_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('virtual_bet_punter','virtual_bet_manual')),
  base_bc INTEGER NOT NULL DEFAULT 0,
  bonus_bc INTEGER NOT NULL DEFAULT 0,
  total_bc INTEGER NOT NULL DEFAULT 0,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bet_id, source)
);

ALTER TABLE public.bc_rewards_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bc rewards"
ON public.bc_rewards_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bc_rewards_user_created ON public.bc_rewards_log (user_id, created_at DESC);

-- 2) Função genérica para creditar BC quando aposta vira vencedora
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
  v_total INT;
  v_won BOOLEAN := FALSE;
BEGIN
  -- Só dispara em transição para vencedora
  IF NEW.result IS NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.result,'')) NOT IN ('won','green','win') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result THEN
    RETURN NEW;
  END IF;

  -- Identifica origem
  v_source := CASE TG_TABLE_NAME
    WHEN 'virtual_bets_punter' THEN 'virtual_bet_punter'
    WHEN 'virtual_bets_manual' THEN 'virtual_bet_manual'
    ELSE NULL
  END;
  IF v_source IS NULL THEN RETURN NEW; END IF;

  -- Bônus proporcional ao lucro: floor((profit/stake) * 100), cap em 450 (total max 500)
  IF NEW.stake IS NOT NULL AND NEW.stake > 0 AND NEW.profit_loss IS NOT NULL AND NEW.profit_loss > 0 THEN
    v_bonus := LEAST(450, FLOOR((NEW.profit_loss / NEW.stake) * 100)::INT);
  END IF;
  v_total := v_base + v_bonus;

  -- Insere idempotente; se já existir, sai sem creditar de novo
  BEGIN
    INSERT INTO public.bc_rewards_log (user_id, bet_id, source, base_bc, bonus_bc, total_bc, motivo)
    VALUES (NEW.user_id, NEW.id, v_source, v_base, v_bonus, v_total,
            'Aposta virtual vencedora: ' || COALESCE(NEW.market,'?'));
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  -- Credita BC no profile
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

DROP TRIGGER IF EXISTS trg_credit_bc_vbp ON public.virtual_bets_punter;
CREATE TRIGGER trg_credit_bc_vbp
AFTER INSERT OR UPDATE OF result ON public.virtual_bets_punter
FOR EACH ROW EXECUTE FUNCTION public.credit_bc_for_virtual_bet();

DROP TRIGGER IF EXISTS trg_credit_bc_vbm ON public.virtual_bets_manual;
CREATE TRIGGER trg_credit_bc_vbm
AFTER INSERT OR UPDATE OF result ON public.virtual_bets_manual
FOR EACH ROW EXECUTE FUNCTION public.credit_bc_for_virtual_bet();
