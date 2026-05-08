
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_username := COALESCE(
    NULLIF(new.raw_user_meta_data ->> 'username', ''),
    'Jogador'
  );

  v_full_name := COALESCE(
    NULLIF(new.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(new.raw_user_meta_data ->> 'name', ''),
    NULLIF(
      TRIM(
        COALESCE(new.raw_user_meta_data ->> 'given_name', '') || ' ' ||
        COALESCE(new.raw_user_meta_data ->> 'family_name', '')
      ),
      ''
    )
  );

  INSERT INTO public.profiles (user_id, username, full_name)
  VALUES (new.id, v_username, v_full_name);
  RETURN new;
END;
$function$;
