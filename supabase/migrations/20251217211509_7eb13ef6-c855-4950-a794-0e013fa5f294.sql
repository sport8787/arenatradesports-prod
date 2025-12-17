-- Create function to calculate rank based on BluffCoins
CREATE OR REPLACE FUNCTION public.calculate_rank_title(coins integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF coins >= 1000000 THEN
    RETURN 'Lenda';
  ELSIF coins >= 100000 THEN
    RETURN 'Mestre';
  ELSIF coins >= 10000 THEN
    RETURN 'Trapaceiro';
  ELSE
    RETURN 'Novato';
  END IF;
END;
$$;

-- Create trigger function to auto-update rank_title
CREATE OR REPLACE FUNCTION public.update_rank_on_coins_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.rank_title := calculate_rank_title(NEW.bluff_coins);
  RETURN NEW;
END;
$$;

-- Create trigger that fires before update on profiles
DROP TRIGGER IF EXISTS update_profile_rank ON public.profiles;
CREATE TRIGGER update_profile_rank
  BEFORE UPDATE OF bluff_coins ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rank_on_coins_change();

-- Also update rank on insert
DROP TRIGGER IF EXISTS set_initial_rank ON public.profiles;
CREATE TRIGGER set_initial_rank
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rank_on_coins_change();

-- Update existing profiles to have correct rank
UPDATE public.profiles SET rank_title = calculate_rank_title(bluff_coins);