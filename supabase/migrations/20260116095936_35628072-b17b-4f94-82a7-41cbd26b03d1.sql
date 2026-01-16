-- Adicionar campos para sistema de streak diário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_streak_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date date NULL;

-- Função para processar streak diário e retornar o bonus BC
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
  v_bonus integer;
  v_max_streak integer := 7;
  v_bonus_per_day integer := 20;
BEGIN
  -- Get current streak info
  SELECT last_streak_date, daily_streak_count
  INTO v_last_streak_date, v_current_streak
  FROM profiles
  WHERE user_id = p_user_id;

  -- Check if already claimed today
  IF v_last_streak_date = v_today THEN
    RETURN 0; -- Already claimed
  END IF;

  -- Check if streak continues (yesterday) or resets
  IF v_last_streak_date = v_today - INTERVAL '1 day' THEN
    -- Streak continues
    v_current_streak := LEAST(v_current_streak + 1, v_max_streak);
  ELSE
    -- Streak resets
    v_current_streak := 1;
  END IF;

  -- Calculate bonus (20 BC per streak day, max 7 = 140 BC)
  v_bonus := v_current_streak * v_bonus_per_day;

  -- Update profile
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