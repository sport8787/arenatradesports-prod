-- Dedup constraint: virtual_bets_punter (apostas ativas por usuário+match)
CREATE UNIQUE INDEX IF NOT EXISTS idx_virtual_bets_punter_dedup
  ON virtual_bets_punter(user_id, match_id)
  WHERE status NOT IN ('dismissed');