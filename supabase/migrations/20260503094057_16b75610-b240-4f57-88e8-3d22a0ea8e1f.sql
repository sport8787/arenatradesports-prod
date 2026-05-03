-- 1) View unificada de ROI: Punter (virtual_bets) + Trader Sports (arena_trader_entries)
CREATE OR REPLACE VIEW public.mycroft_user_roi AS
WITH punter_ops AS (
  SELECT
    vb.user_id,
    vb.stake::numeric                AS stake,
    vb.odd::numeric                  AS odd,
    LOWER(vb.status)                 AS status_norm
  FROM public.virtual_bets vb
  WHERE vb.status IS NOT NULL
    AND LOWER(vb.status) IN ('green','won','win','red','lost','loss','push')
    AND vb.odd IS NOT NULL AND vb.odd > 0
    AND vb.stake IS NOT NULL AND vb.stake > 0
),
trader_ops AS (
  SELECT
    ate.user_id,
    ate.stake_value::numeric         AS stake,
    ate.odd::numeric                 AS odd,
    LOWER(ate.status)                AS status_norm
  FROM public.arena_trader_entries ate
  WHERE ate.status IS NOT NULL
    AND LOWER(ate.status) IN ('green','red','cashout')
    AND ate.odd IS NOT NULL AND ate.odd > 0
    AND ate.stake_value IS NOT NULL AND ate.stake_value > 0
),
all_ops AS (
  SELECT user_id, stake, odd, status_norm,
         CASE
           WHEN status_norm IN ('green','won','win') THEN stake * odd
           WHEN status_norm = 'push' THEN stake
           WHEN status_norm = 'cashout' THEN stake
           ELSE 0
         END AS retorno
  FROM punter_ops
  UNION ALL
  SELECT user_id, stake, odd, status_norm,
         CASE
           WHEN status_norm = 'green' THEN stake * odd
           WHEN status_norm = 'cashout' THEN stake
           ELSE 0
         END AS retorno
  FROM trader_ops
)
SELECT
  user_id,
  COUNT(*)::int                                                            AS total_bets,
  COUNT(*) FILTER (WHERE status_norm IN ('green','won','win'))::int        AS greens,
  COUNT(*) FILTER (WHERE status_norm IN ('red','lost','loss'))::int        AS reds,
  COUNT(*) FILTER (WHERE status_norm = 'push')::int                        AS pushes,
  COALESCE(SUM(stake), 0)::numeric                                         AS total_staked,
  COALESCE(SUM(retorno), 0)::numeric                                       AS total_returned,
  ROUND(
    CASE WHEN COALESCE(SUM(stake), 0) > 0
      THEN ((SUM(retorno) - SUM(stake)) / SUM(stake) * 100)::numeric
      ELSE 0 END
  , 2) AS roi_pct
FROM all_ops
GROUP BY user_id;

-- 2) Recria leaderboard consumindo a fonte unificada
DROP VIEW IF EXISTS public.liga_mycroft_leaderboard;

CREATE VIEW public.liga_mycroft_leaderboard AS
WITH real_users AS (
  SELECT
    r.user_id::text AS row_key,
    r.user_id,
    NULL::uuid AS seed_id,
    false AS is_horus,
    false AS is_fake,
    CASE
      WHEN COALESCE(p.username, '') = '' THEN 'Trader***'
      ELSE LEFT(p.username, 3) || repeat('*', GREATEST(LEAST(LENGTH(p.username) - 3, 6), 1))
    END AS display_name,
    r.total_bets,
    r.greens,
    r.reds,
    r.total_staked,
    r.total_returned,
    r.roi_pct
  FROM public.mycroft_user_roi r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.total_bets >= 5
),
seed_users AS (
  SELECT
    'seed:' || s.id::text AS row_key,
    NULL::uuid AS user_id,
    s.id AS seed_id,
    s.is_horus,
    NOT s.is_horus AS is_fake,
    s.display_name,
    s.total_bets,
    s.greens,
    s.reds,
    s.total_staked,
    s.total_returned,
    ROUND(
      CASE WHEN s.total_staked > 0
        THEN ((s.total_returned - s.total_staked) / s.total_staked * 100)::numeric
        ELSE 0 END
    , 2) AS roi_pct
  FROM public.liga_mycroft_seed_users s
),
combined AS (
  SELECT * FROM real_users
  UNION ALL
  SELECT * FROM seed_users
)
SELECT
  row_key, user_id, seed_id, is_horus, is_fake,
  display_name, total_bets, greens, reds,
  total_staked, total_returned, roi_pct,
  RANK() OVER (ORDER BY roi_pct DESC, total_bets DESC) AS rank
FROM combined;