-- Função para incrementar BluffCoins de forma atômica e segura
CREATE OR REPLACE FUNCTION public.increment_bluffcoins(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET bluff_coins = bluff_coins + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;