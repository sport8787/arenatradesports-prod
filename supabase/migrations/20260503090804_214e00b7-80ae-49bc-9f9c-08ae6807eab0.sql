
-- 1) Trigger: garante que virtual_bets sempre tem odd (copia de punter_signals se faltar)
CREATE OR REPLACE FUNCTION public.ensure_virtual_bet_odd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signal_odd NUMERIC;
BEGIN
  IF (NEW.odd IS NULL OR NEW.odd <= 0) AND NEW.signal_id IS NOT NULL THEN
    SELECT odd INTO v_signal_odd
    FROM public.punter_signals
    WHERE id = NEW.signal_id
    LIMIT 1;

    IF v_signal_odd IS NOT NULL AND v_signal_odd > 0 THEN
      NEW.odd := v_signal_odd;
      IF NEW.entry_odd IS NULL THEN
        NEW.entry_odd := v_signal_odd;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_virtual_bet_odd ON public.virtual_bets;
CREATE TRIGGER trg_ensure_virtual_bet_odd
BEFORE INSERT OR UPDATE OF signal_id ON public.virtual_bets
FOR EACH ROW
EXECUTE FUNCTION public.ensure_virtual_bet_odd();

-- 2) View de ROI por usuário usando fórmula explícita stake × odd
CREATE OR REPLACE VIEW public.punter_user_roi AS
SELECT
  vb.user_id,
  COUNT(*)::int AS total_bets,
  COUNT(*) FILTER (WHERE LOWER(vb.status) IN ('green','won','win'))::int AS greens,
  COUNT(*) FILTER (WHERE LOWER(vb.status) IN ('red','lost','loss'))::int AS reds,
  COUNT(*) FILTER (WHERE LOWER(vb.status) = 'push')::int AS pushes,
  COALESCE(SUM(vb.stake), 0)::numeric AS total_staked,
  -- Retorno explícito: GREEN=stake*odd, RED=0, PUSH=stake (devolução)
  COALESCE(SUM(
    CASE
      WHEN LOWER(vb.status) IN ('green','won','win') THEN vb.stake * vb.odd
      WHEN LOWER(vb.status) = 'push' THEN vb.stake
      ELSE 0
    END
  ), 0)::numeric AS total_returned,
  ROUND(
    CASE WHEN COALESCE(SUM(vb.stake),0) > 0 THEN
      ((SUM(
        CASE
          WHEN LOWER(vb.status) IN ('green','won','win') THEN vb.stake * vb.odd
          WHEN LOWER(vb.status) = 'push' THEN vb.stake
          ELSE 0
        END
      ) - SUM(vb.stake)) / SUM(vb.stake) * 100)::numeric
    ELSE 0 END
  , 2) AS roi_pct
FROM public.virtual_bets vb
WHERE vb.status IS NOT NULL
  AND LOWER(vb.status) IN ('green','won','win','red','lost','loss','push')
  AND vb.odd IS NOT NULL AND vb.odd > 0
  AND vb.stake IS NOT NULL AND vb.stake > 0
GROUP BY vb.user_id;

-- 3) Atualiza leaderboard para usar a nova view de ROI
CREATE OR REPLACE VIEW public.liga_mycroft_leaderboard AS
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
  FROM public.punter_user_roi r
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
  WHERE s.active = true AND s.total_bets >= 5
),
combined AS (
  SELECT * FROM real_users
  UNION ALL
  SELECT * FROM seed_users
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
FROM combined
ORDER BY roi_pct DESC, greens DESC, total_bets DESC
LIMIT 50;
