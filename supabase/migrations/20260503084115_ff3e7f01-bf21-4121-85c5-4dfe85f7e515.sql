
DROP VIEW IF EXISTS public.bc_leaderboard_weekly;
CREATE VIEW public.bc_leaderboard_weekly
WITH (security_invoker = true)
AS
WITH agg AS (
  SELECT
    r.user_id,
    SUM(r.total_bc)::INT AS bc_week,
    COUNT(*)::INT AS wins_week
  FROM public.bc_rewards_log r
  WHERE r.created_at >= now() - interval '7 days'
  GROUP BY r.user_id
)
SELECT
  ROW_NUMBER() OVER (ORDER BY a.bc_week DESC) AS rank,
  a.user_id,
  -- Nick anonimizado: primeiras 3 letras + ***
  CASE
    WHEN COALESCE(p.username,'') = '' THEN 'Trader***'
    ELSE LEFT(p.username, 3) || REPEAT('*', GREATEST(LEAST(LENGTH(p.username) - 3, 6), 1))
  END AS display_name,
  a.bc_week,
  a.wins_week
FROM agg a
LEFT JOIN public.profiles p ON p.user_id = a.user_id
ORDER BY a.bc_week DESC
LIMIT 50;

GRANT SELECT ON public.bc_leaderboard_weekly TO authenticated, anon;
