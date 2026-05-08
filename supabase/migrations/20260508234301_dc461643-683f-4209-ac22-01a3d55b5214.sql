
UPDATE public.profiles p
SET full_name = sub.derived_name,
    updated_at = now()
FROM (
  SELECT
    u.id AS user_id,
    NULLIF(
      COALESCE(
        NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(u.raw_user_meta_data ->> 'name', ''),
        NULLIF(
          TRIM(
            COALESCE(u.raw_user_meta_data ->> 'given_name', '') || ' ' ||
            COALESCE(u.raw_user_meta_data ->> 'family_name', '')
          ),
          ''
        )
      ),
      ''
    ) AS derived_name
  FROM auth.users u
) sub
WHERE p.user_id = sub.user_id
  AND sub.derived_name IS NOT NULL
  AND (p.full_name IS NULL OR p.full_name = '');
