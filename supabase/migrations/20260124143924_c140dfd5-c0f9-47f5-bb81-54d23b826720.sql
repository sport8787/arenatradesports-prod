-- Create user_vocal_profiles table for adaptive baseline
CREATE TABLE IF NOT EXISTS public.user_vocal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  samples_count INT DEFAULT 0,
  
  -- Baseline metrics
  avg_pitch DECIMAL(10,2) DEFAULT 0,
  avg_jitter DECIMAL(10,6) DEFAULT 0,
  avg_shimmer DECIMAL(10,6) DEFAULT 0,
  avg_latency DECIMAL(10,2) DEFAULT 0,
  avg_speech_rate DECIMAL(10,2) DEFAULT 0,
  
  -- Standard deviations
  pitch_std_dev DECIMAL(10,2) DEFAULT 0,
  jitter_std_dev DECIMAL(10,6) DEFAULT 0,
  shimmer_std_dev DECIMAL(10,6) DEFAULT 0,
  latency_std_dev DECIMAL(10,2) DEFAULT 0,
  speech_rate_std_dev DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_user_vocal_profiles_user_id ON public.user_vocal_profiles(user_id);

-- Enable RLS
ALTER TABLE public.user_vocal_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vocal profile"
  ON public.user_vocal_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocal profile"
  ON public.user_vocal_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocal profile"
  ON public.user_vocal_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow system to manage profiles (for edge functions)
CREATE POLICY "System can manage vocal profiles"
  ON public.user_vocal_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);