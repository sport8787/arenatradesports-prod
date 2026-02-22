
-- Enable realtime for bankroll updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_bankroll;

-- Add update policy for virtual_bets (to settle bets)
CREATE POLICY "Users update own bets"
  ON virtual_bets FOR UPDATE
  USING (auth.uid() = user_id);
