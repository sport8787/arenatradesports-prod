
-- Add training completion flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sports_training_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sports_training_completed_at timestamptz;

-- Training sessions tracking
CREATE TABLE public.sports_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenarios_total integer NOT NULL DEFAULT 15,
  scenarios_answered integer NOT NULL DEFAULT 0,
  scenarios_correct integer NOT NULL DEFAULT 0,
  accuracy numeric(5,2) NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  bluff_coins_earned integer NOT NULL DEFAULT 0,
  scenarios_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.sports_training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own training sessions"
  ON public.sports_training_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
