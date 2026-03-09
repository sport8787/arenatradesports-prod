CREATE OR REPLACE FUNCTION public.deduct_bankroll(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_bankroll
  SET balance = balance - p_amount,
      total_staked = total_staked + p_amount,
      total_bets = total_bets + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND balance >= p_amount;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;