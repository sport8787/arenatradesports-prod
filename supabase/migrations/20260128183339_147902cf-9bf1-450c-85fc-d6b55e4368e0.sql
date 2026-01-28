-- Create table for storing biometric calibration baselines
CREATE TABLE public.biometric_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  
  -- Vocal baseline - Truth
  truth_avg_pitch NUMERIC,
  truth_pitch_variance NUMERIC,
  truth_jitter NUMERIC,
  truth_shimmer NUMERIC,
  truth_speech_rate NUMERIC,
  truth_response_latency NUMERIC,
  truth_silent_periods INTEGER,
  truth_longest_pause NUMERIC,
  truth_speech_continuity NUMERIC,
  
  -- Vocal baseline - Lie
  lie_avg_pitch NUMERIC,
  lie_pitch_variance NUMERIC,
  lie_jitter NUMERIC,
  lie_shimmer NUMERIC,
  lie_speech_rate NUMERIC,
  lie_response_latency NUMERIC,
  lie_silent_periods INTEGER,
  lie_longest_pause NUMERIC,
  lie_speech_continuity NUMERIC,
  
  -- Facial baseline - Truth (nullable for audio-only calibration)
  truth_blink_rate NUMERIC,
  truth_lip_tension NUMERIC,
  truth_brow_asymmetry NUMERIC,
  truth_facial_stress_score NUMERIC,
  truth_gaze_deviation NUMERIC,
  truth_mouth_openness NUMERIC,
  truth_face_symmetry NUMERIC,
  
  -- Facial baseline - Lie
  lie_blink_rate NUMERIC,
  lie_lip_tension NUMERIC,
  lie_brow_asymmetry NUMERIC,
  lie_facial_stress_score NUMERIC,
  lie_gaze_deviation NUMERIC,
  lie_mouth_openness NUMERIC,
  lie_face_symmetry NUMERIC,
  
  -- Calculated thresholds
  pitch_deviation_threshold NUMERIC,
  jitter_deviation_threshold NUMERIC,
  stress_score_deviation_threshold NUMERIC,
  blink_rate_deviation_threshold NUMERIC,
  lip_tension_deviation_threshold NUMERIC,
  
  -- Metadata
  capture_mode TEXT NOT NULL DEFAULT 'audio',
  calibrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  is_valid BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_biometric_baselines_user_id ON public.biometric_baselines(user_id);
CREATE INDEX idx_biometric_baselines_session_id ON public.biometric_baselines(session_id);
CREATE INDEX idx_biometric_baselines_valid ON public.biometric_baselines(is_valid, expires_at);

-- Enable RLS
ALTER TABLE public.biometric_baselines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own baselines"
ON public.biometric_baselines
FOR SELECT
USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "Users can insert their own baselines"
ON public.biometric_baselines
FOR INSERT
WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

CREATE POLICY "Users can update their own baselines"
ON public.biometric_baselines
FOR UPDATE
USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "System can manage all baselines"
ON public.biometric_baselines
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_biometric_baselines_updated_at
BEFORE UPDATE ON public.biometric_baselines
FOR EACH ROW
EXECUTE FUNCTION public.update_rankings_updated_at();