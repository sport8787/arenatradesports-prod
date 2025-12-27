-- Adicionar colunas de saldo na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nt_balance integer NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS bc_balance integer NOT NULL DEFAULT 0;

-- Função para incrementar Neuro-Tokens
CREATE OR REPLACE FUNCTION public.increment_nt_balance(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET nt_balance = nt_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

-- Função para incrementar BleffCoins
CREATE OR REPLACE FUNCTION public.increment_bc_balance(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET bc_balance = bc_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

-- Função para decrementar Neuro-Tokens (com validação)
CREATE OR REPLACE FUNCTION public.spend_nt_balance(p_user_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  SELECT nt_balance INTO current_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
  
  IF current_balance < p_amount THEN
    RETURN false;
  END IF;
  
  UPDATE public.profiles
  SET nt_balance = nt_balance - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;