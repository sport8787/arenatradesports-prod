
-- Training scenario history with perspectives for style analysis
CREATE TABLE public.training_scenario_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT,
  scenario_number INTEGER NOT NULL,
  street TEXT,
  hero_cards TEXT,
  board_cards TEXT,
  player_action TEXT NOT NULL,
  correct_action TEXT NOT NULL,
  was_correct BOOLEAN NOT NULL DEFAULT false,
  nota INTEGER,
  ev_diferenca TEXT,
  -- Perspectives data
  tag_acao TEXT,
  tag_ev TEXT,
  lag_acao TEXT,
  lag_ev TEXT,
  gto_acao TEXT,
  gto_ev TEXT,
  player_ev TEXT,
  best_style TEXT,
  -- Which style matched the player's action
  player_matched_style TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_scenario_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own training history"
  ON public.training_scenario_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own training history"
  ON public.training_scenario_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for user queries
CREATE INDEX idx_training_history_user ON public.training_scenario_history(user_id, created_at DESC);
