
-- Liga Mycroft: tabela de usuários fake/seed para popular ranking inicial e Hórus
CREATE TABLE IF NOT EXISTS public.liga_mycroft_seed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  is_horus BOOLEAN NOT NULL DEFAULT false,
  total_bets INT NOT NULL DEFAULT 0,
  greens INT NOT NULL DEFAULT 0,
  reds INT NOT NULL DEFAULT 0,
  total_staked NUMERIC NOT NULL DEFAULT 0,
  total_returned NUMERIC NOT NULL DEFAULT 0,
  bc_earned INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.liga_mycroft_seed_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view liga seed users"
ON public.liga_mycroft_seed_users
FOR SELECT
TO authenticated, anon
USING (active = true);

-- View do ranking unificado por ROI%
-- Combina:
--   1) Usuários reais (virtual_bets liquidadas com profit_loss IS NOT NULL)
--   2) Hórus (sinais de mycroft_signals/punter_signals com result definido) — agregado simulado
--   3) Usuários fake da liga_mycroft_seed_users
-- ROI% = (total_returned - total_staked) / total_staked * 100
-- Mínimo: 5 apostas para entrar no ranking (evita ROI distorcido)

CREATE OR REPLACE VIEW public.liga_mycroft_leaderboard AS
WITH real_users AS (
  SELECT
    vb.user_id::text AS row_key,
    vb.user_id,
    NULL::uuid AS seed_id,
    false AS is_horus,
    false AS is_fake,
    CASE
      WHEN COALESCE(p.username, '') = '' THEN 'Trader***'
      ELSE LEFT(p.username, 3) || repeat('*', GREATEST(LEAST(LENGTH(p.username) - 3, 6), 1))
    END AS display_name,
    COUNT(*)::int AS total_bets,
    COUNT(*) FILTER (WHERE LOWER(vb.status) IN ('won','green','win'))::int AS greens,
    COUNT(*) FILTER (WHERE LOWER(vb.status) IN ('lost','red','loss'))::int AS reds,
    COALESCE(SUM(vb.stake), 0) AS total_staked,
    COALESCE(SUM(vb.stake + vb.profit_loss), 0) AS total_returned
  FROM public.virtual_bets vb
  LEFT JOIN public.profiles p ON p.user_id = vb.user_id
  WHERE vb.profit_loss IS NOT NULL
    AND vb.stake > 0
  GROUP BY vb.user_id, p.username
  HAVING COUNT(*) >= 5
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
    s.total_returned
  FROM public.liga_mycroft_seed_users s
  WHERE s.active = true AND s.total_bets >= 5
),
combined AS (
  SELECT * FROM real_users
  UNION ALL
  SELECT * FROM seed_users
),
scored AS (
  SELECT
    c.*,
    CASE WHEN c.total_staked > 0
      THEN ROUND(((c.total_returned - c.total_staked) / c.total_staked * 100)::numeric, 2)
      ELSE 0
    END AS roi_pct
  FROM combined c
)
SELECT
  ROW_NUMBER() OVER (ORDER BY roi_pct DESC, greens DESC, total_bets DESC)::int AS rank,
  row_key,
  user_id,
  seed_id,
  is_horus,
  is_fake,
  display_name,
  total_bets,
  greens,
  reds,
  total_staked,
  total_returned,
  roi_pct
FROM scored
ORDER BY roi_pct DESC, greens DESC, total_bets DESC
LIMIT 50;
