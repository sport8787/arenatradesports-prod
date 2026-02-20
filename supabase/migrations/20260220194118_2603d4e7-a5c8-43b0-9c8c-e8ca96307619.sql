
-- ═══════════════════════════════════════════════════════════
-- TRAINING RUNS — Overall survival run tracking
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.training_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  difficulty_level_start TEXT NOT NULL DEFAULT 'medium',
  lives_start INTEGER NOT NULL DEFAULT 3,
  lives_remaining INTEGER NOT NULL DEFAULT 3,
  bankroll_start INTEGER NOT NULL DEFAULT 5000,
  bankroll_current INTEGER NOT NULL DEFAULT 5000,
  hands_completed INTEGER NOT NULL DEFAULT 0,
  hands_target INTEGER NOT NULL DEFAULT 10,
  golden_ticket_progress_delta INTEGER NOT NULL DEFAULT 0,
  error_mode TEXT NOT NULL DEFAULT 'challenge' CHECK (error_mode IN ('study', 'challenge')),
  engine_module TEXT NOT NULL DEFAULT 'arena_poker',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.training_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own training runs"
  ON public.training_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own training runs"
  ON public.training_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own training runs"
  ON public.training_runs FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- TRAINING HAND SESSIONS — One per hand within a run
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.training_hand_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_run_id UUID NOT NULL REFERENCES public.training_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  hand_number INTEGER NOT NULL DEFAULT 1,
  hero_hole_cards TEXT NOT NULL,
  villain_profile TEXT,
  villain_name TEXT,
  initial_stacks_json JSONB,
  blind_level TEXT,
  ante TEXT,
  position_hero TEXT,
  position_villain TEXT,
  metadata_json JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'cleared', 'failed')),
  current_street TEXT NOT NULL DEFAULT 'preflop' CHECK (current_street IN ('preflop', 'flop', 'turn', 'river', 'completed')),
  board_cards_flop TEXT,
  board_cards_turn TEXT,
  board_cards_river TEXT,
  pot_size INTEGER NOT NULL DEFAULT 0,
  hero_stack INTEGER NOT NULL DEFAULT 0,
  villain_stack INTEGER NOT NULL DEFAULT 0,
  bc_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_hand_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own hand sessions"
  ON public.training_hand_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own hand sessions"
  ON public.training_hand_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own hand sessions"
  ON public.training_hand_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- TRAINING STREETS — Up to 4 per hand session
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.training_streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_hand_session_id UUID NOT NULL REFERENCES public.training_hand_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  street TEXT NOT NULL CHECK (street IN ('preflop', 'flop', 'turn', 'river')),
  board_cards TEXT,
  pot_size INTEGER NOT NULL DEFAULT 0,
  hero_stack INTEGER NOT NULL DEFAULT 0,
  villain_stack INTEGER NOT NULL DEFAULT 0,
  action_history_json JSONB,
  scenario_text TEXT,
  hero_options_json JSONB,
  hero_decision TEXT,
  hero_bet_size INTEGER,
  correct_action_json JSONB,
  result TEXT CHECK (result IN ('correct', 'incorrect', 'pending')),
  feedback_mycroft_text TEXT,
  verdict_horus_text TEXT,
  nota INTEGER,
  ev_analysis_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_streets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own streets"
  ON public.training_streets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own streets"
  ON public.training_streets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own streets"
  ON public.training_streets FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- BLUFF TALK ATTEMPTS — Optional video provocation
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.bluff_talk_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_street_id UUID NOT NULL REFERENCES public.training_streets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  intent TEXT CHECK (intent IN ('intimidate', 'induce_call', 'induce_fold')),
  video_url TEXT,
  transcript_text TEXT,
  bluff_score INTEGER,
  mycroft_bluff_feedback_text TEXT,
  suggested_phrases_json JSONB,
  alignment_check TEXT,
  opponent_reaction TEXT,
  leak_detection TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bluff_talk_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own bluff attempts"
  ON public.bluff_talk_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bluff attempts"
  ON public.bluff_talk_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own bluff attempts"
  ON public.bluff_talk_attempts FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_training_runs_user ON public.training_runs(user_id);
CREATE INDEX idx_training_runs_status ON public.training_runs(status);
CREATE INDEX idx_training_hand_sessions_run ON public.training_hand_sessions(training_run_id);
CREATE INDEX idx_training_streets_session ON public.training_streets(training_hand_session_id);
CREATE INDEX idx_bluff_talk_street ON public.bluff_talk_attempts(training_street_id);
