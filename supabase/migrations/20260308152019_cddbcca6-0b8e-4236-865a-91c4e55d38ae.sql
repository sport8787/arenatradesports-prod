
-- Fix Hórus bankroll (user_bankroll) with correct computed values
UPDATE public.user_bankroll
SET 
  balance = 13671.99,
  total_staked = 36178.41,
  total_profit = 9146.25,
  green_bets = 66,
  red_bets = 45,
  total_bets = 141,
  win_rate = 59.46,
  updated_at = now()
WHERE user_id = '0b6a62ef-e3b7-439a-bdfb-19cd9fce2b08';

-- Fix Manual bankroll with correct computed values
UPDATE public.manual_bankroll
SET 
  balance = 6541.36,
  total_staked = 13278.99,
  total_profit = 2019.54,
  green_bets = 17,
  red_bets = 8,
  total_bets = 50,
  win_rate = 68.00,
  updated_at = now()
WHERE user_id = '0b6a62ef-e3b7-439a-bdfb-19cd9fce2b08';
