-- Add last_daily_bonus column to profiles for tracking daily NT bonus
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_daily_bonus DATE DEFAULT NULL;

-- Create function to claim daily NT bonus
CREATE OR REPLACE FUNCTION public.claim_daily_nt_bonus(p_user_id uuid, p_amount integer DEFAULT 100)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_claim DATE;
  current_date_utc DATE := CURRENT_DATE;
BEGIN
  -- Get the last claim date
  SELECT last_daily_bonus INTO last_claim
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
  
  -- Check if already claimed today
  IF last_claim IS NOT NULL AND last_claim = current_date_utc THEN
    RETURN false;
  END IF;
  
  -- Grant the bonus and update the last claim date
  UPDATE public.profiles
  SET nt_balance = nt_balance + p_amount,
      last_daily_bonus = current_date_utc,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;