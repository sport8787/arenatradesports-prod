UPDATE public.api_key_expirations
SET expires_at = '2026-06-11', notes = 'Trial 14d rotacionado em 28/05/2026', updated_at = now()
WHERE api_name = 'sportmonks';