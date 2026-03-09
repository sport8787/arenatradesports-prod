CREATE OR REPLACE FUNCTION public.deduct_manual_bankroll(p_user_id uuid, p_amount numeric)
RETURNS boolean AS $$
BEGIN
  UPDATE manual_bankroll
  SET balance = balance - p_amount,
      total_staked = total_staked + p_amount,
      total_bets = total_bets + 1,
      updated_at = now()
  WHERE user_id = p_user_id AND balance >= p_amount;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;