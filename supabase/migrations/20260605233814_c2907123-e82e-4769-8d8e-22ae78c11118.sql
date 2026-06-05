UPDATE public.sinais_alavanca
SET status = 'void'
WHERE status = 'pending'
  AND (
    (mode = 'prelive' AND kickoff IS NOT NULL AND kickoff < now())
    OR (mode = 'live' AND created_at < now() - interval '4 hours')
    OR (mode = 'prelive' AND kickoff IS NULL AND created_at < now() - interval '36 hours')
  );