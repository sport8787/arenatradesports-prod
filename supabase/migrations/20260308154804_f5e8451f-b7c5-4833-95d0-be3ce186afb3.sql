
-- Fix Hórus bankroll with correct values from actual bet audit
UPDATE public.user_bankroll SET
  balance = 667.94,
  total_staked = 1108.88,
  total_profit = 263.58,
  total_bets = 51,
  green_bets = 17,
  red_bets = 6,
  win_rate = 73.91,
  updated_at = now()
WHERE user_id = 'c0877bbe-686d-4c04-ae61-c128b0c2946e';

-- Fix Manual bankroll with correct values from actual bet audit
UPDATE public.manual_bankroll SET
  balance = 985.25,
  total_staked = 544.86,
  total_profit = 147.96,
  total_bets = 38,
  green_bets = 16,
  red_bets = 6,
  win_rate = 72.73,
  updated_at = now()
WHERE user_id = 'c0877bbe-686d-4c04-ae61-c128b0c2946e';
