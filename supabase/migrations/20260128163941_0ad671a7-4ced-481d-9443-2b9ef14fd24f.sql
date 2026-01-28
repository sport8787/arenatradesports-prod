-- ================================================
-- MYCROFT ML TRAINING DATA SCHEMA
-- ================================================

-- 1. MATCHES TABLE - Metadados da partida
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  
  -- Modo e configuração
  game_mode TEXT NOT NULL DEFAULT 'solo', -- 'solo' | 'multiplayer' | 'presenter'
  difficulty_mode TEXT DEFAULT 'desafio', -- 'aquecimento' | 'desafio' | 'extremo'
  total_rounds INTEGER DEFAULT 10,
  
  -- Metadados técnicos
  app_version TEXT DEFAULT '1.0.0',
  device_type TEXT DEFAULT 'desktop', -- 'desktop' | 'mobile' | 'tablet'
  user_agent TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  
  -- Resultado
  final_score INTEGER DEFAULT 0,
  rounds_completed INTEGER DEFAULT 0,
  was_completed BOOLEAN DEFAULT false,
  
  -- Jogador (para solo)
  player_session_id TEXT,
  player_user_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Matches are viewable by participants"
  ON public.matches FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants can update their matches"
  ON public.matches FOR UPDATE
  USING (true);

-- 2. EXTEND voice_recordings with ML-relevant fields
ALTER TABLE public.voice_recordings
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capture_mode TEXT DEFAULT 'audio', -- 'audio' | 'video'
  ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS consent_level TEXT DEFAULT 'metrics_only', -- 'metrics_only' | 'training_opt_in'
  ADD COLUMN IF NOT EXISTS question_difficulty TEXT,
  ADD COLUMN IF NOT EXISTS question_category TEXT,
  ADD COLUMN IF NOT EXISTS answer_was_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS time_to_answer_ms INTEGER,
  ADD COLUMN IF NOT EXISTS words_per_minute NUMERIC,
  ADD COLUMN IF NOT EXISTS silent_periods_count INTEGER,
  ADD COLUMN IF NOT EXISTS longest_pause_ms INTEGER,
  ADD COLUMN IF NOT EXISTS filler_words_count INTEGER,
  ADD COLUMN IF NOT EXISTS speech_continuity NUMERIC,
  ADD COLUMN IF NOT EXISTS blink_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS brow_asymmetry NUMERIC,
  ADD COLUMN IF NOT EXISTS lip_tension NUMERIC;

-- 3. EXTEND votes with AI jury support
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS voter_type TEXT DEFAULT 'human', -- 'human' | 'ai'
  ADD COLUMN IF NOT EXISTS ai_profile TEXT, -- 'prudente' | 'tubarao' | 'quant'
  ADD COLUMN IF NOT EXISTS confidence_level NUMERIC, -- 0-100
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES public.voice_recordings(id) ON DELETE SET NULL;

-- 4. TRAINING LABELS TABLE - Labels finais para ML
CREATE TABLE public.training_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.voice_recordings(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  
  -- Ground truth
  player_was_bluffing BOOLEAN, -- Resposta objetiva (errou a pergunta = blefou)
  player_claimed_truth BOOLEAN, -- O que o jogador alegou
  
  -- Votos agregados
  total_votes INTEGER DEFAULT 0,
  votes_believe INTEGER DEFAULT 0,
  votes_doubt INTEGER DEFAULT 0,
  
  -- Votos por tipo
  human_votes_believe INTEGER DEFAULT 0,
  human_votes_doubt INTEGER DEFAULT 0,
  ai_votes_believe INTEGER DEFAULT 0,
  ai_votes_doubt INTEGER DEFAULT 0,
  
  -- Label final calculado
  final_label TEXT, -- 'CLARO' | 'BLEFE'
  label_source TEXT, -- 'ground_truth' | 'human_majority' | 'ai_majority' | 'consensus'
  consensus_score NUMERIC, -- 0-100 (unanimidade = 100)
  label_quality TEXT, -- 'high' | 'medium' | 'low'
  
  -- Métricas resumidas (snapshot para ML)
  metrics_snapshot JSONB, -- Cópia das métricas no momento do label
  
  -- Flags para treinamento
  is_valid_for_training BOOLEAN DEFAULT true,
  exclusion_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_labels ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Training labels are viewable"
  ON public.training_labels FOR SELECT
  USING (true);

CREATE POLICY "System can manage training labels"
  ON public.training_labels FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. CONSENT TRACKING TABLE - Auditoria LGPD
CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  
  -- Tipo de consentimento
  consent_type TEXT NOT NULL, -- 'mycroft_analysis' | 'training_opt_in' | 'video_capture'
  consent_given BOOLEAN NOT NULL,
  consent_version TEXT DEFAULT '1.0',
  
  -- Metadados
  ip_hash TEXT, -- Hash do IP (não o IP real)
  user_agent TEXT,
  
  -- Timestamps
  given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own consent"
  ON public.consent_records FOR SELECT
  USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "Anyone can record consent"
  ON public.consent_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can revoke their consent"
  ON public.consent_records FOR UPDATE
  USING (auth.uid() = user_id OR session_id IS NOT NULL);

-- 6. INDEXES for ML queries
CREATE INDEX IF NOT EXISTS idx_voice_recordings_match ON public.voice_recordings(match_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_consent ON public.voice_recordings(consent_level);
CREATE INDEX IF NOT EXISTS idx_training_labels_quality ON public.training_labels(label_quality, is_valid_for_training);
CREATE INDEX IF NOT EXISTS idx_votes_recording ON public.votes(recording_id);
CREATE INDEX IF NOT EXISTS idx_matches_mode ON public.matches(game_mode);

-- 7. FUNCTION to generate training label after voting
CREATE OR REPLACE FUNCTION public.generate_training_label(p_recording_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label_id UUID;
  v_recording RECORD;
  v_votes RECORD;
  v_consensus NUMERIC;
  v_label TEXT;
  v_source TEXT;
  v_quality TEXT;
BEGIN
  -- Get recording data
  SELECT * INTO v_recording FROM voice_recordings WHERE id = p_recording_id;
  
  IF v_recording IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Aggregate votes
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE vote_type = 'believe') as believe,
    COUNT(*) FILTER (WHERE vote_type = 'doubt') as doubt,
    COUNT(*) FILTER (WHERE voter_type = 'human' AND vote_type = 'believe') as human_believe,
    COUNT(*) FILTER (WHERE voter_type = 'human' AND vote_type = 'doubt') as human_doubt,
    COUNT(*) FILTER (WHERE voter_type = 'ai' AND vote_type = 'believe') as ai_believe,
    COUNT(*) FILTER (WHERE voter_type = 'ai' AND vote_type = 'doubt') as ai_doubt
  INTO v_votes
  FROM votes
  WHERE recording_id = p_recording_id;
  
  -- Determine label and source
  IF v_recording.was_bluffing IS NOT NULL THEN
    v_label := CASE WHEN v_recording.was_bluffing THEN 'BLEFE' ELSE 'CLARO' END;
    v_source := 'ground_truth';
    v_quality := 'high';
  ELSIF v_votes.total > 0 THEN
    IF v_votes.believe > v_votes.doubt THEN
      v_label := 'CLARO';
    ELSE
      v_label := 'BLEFE';
    END IF;
    
    -- Determine source
    IF v_votes.human_believe + v_votes.human_doubt > 0 THEN
      v_source := 'human_majority';
    ELSE
      v_source := 'ai_majority';
    END IF;
    
    -- Calculate consensus
    v_consensus := GREATEST(v_votes.believe, v_votes.doubt)::NUMERIC / NULLIF(v_votes.total, 0) * 100;
    
    -- Determine quality
    IF v_consensus >= 80 THEN
      v_quality := 'high';
    ELSIF v_consensus >= 60 THEN
      v_quality := 'medium';
    ELSE
      v_quality := 'low';
    END IF;
  ELSE
    RETURN NULL; -- No votes, no label
  END IF;
  
  -- Insert or update training label
  INSERT INTO training_labels (
    recording_id,
    match_id,
    question_id,
    player_was_bluffing,
    total_votes,
    votes_believe,
    votes_doubt,
    human_votes_believe,
    human_votes_doubt,
    ai_votes_believe,
    ai_votes_doubt,
    final_label,
    label_source,
    consensus_score,
    label_quality,
    metrics_snapshot
  ) VALUES (
    p_recording_id,
    v_recording.match_id,
    v_recording.question_id,
    v_recording.was_bluffing,
    v_votes.total,
    v_votes.believe,
    v_votes.doubt,
    v_votes.human_believe,
    v_votes.human_doubt,
    v_votes.ai_believe,
    v_votes.ai_doubt,
    v_label,
    v_source,
    v_consensus,
    v_quality,
    jsonb_build_object(
      'jitter', v_recording.jitter,
      'shimmer', v_recording.shimmer,
      'pitch', v_recording.avg_pitch,
      'latency', v_recording.response_latency_ms,
      'stress_score', v_recording.stress_score,
      'facial_stress', v_recording.facial_stress_score,
      'combined_score', v_recording.combined_suspicion_score
    )
  )
  ON CONFLICT (recording_id) DO UPDATE SET
    total_votes = EXCLUDED.total_votes,
    votes_believe = EXCLUDED.votes_believe,
    votes_doubt = EXCLUDED.votes_doubt,
    final_label = EXCLUDED.final_label,
    consensus_score = EXCLUDED.consensus_score,
    label_quality = EXCLUDED.label_quality
  RETURNING id INTO v_label_id;
  
  RETURN v_label_id;
END;
$$;

-- Add unique constraint for training_labels
ALTER TABLE public.training_labels 
  ADD CONSTRAINT training_labels_recording_unique UNIQUE (recording_id);