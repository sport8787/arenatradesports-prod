-- Create table to store voice recordings and metrics for Mycroft AI learning
CREATE TABLE public.voice_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  audio_url TEXT NOT NULL,
  
  -- Voice Metrics
  avg_pitch NUMERIC(10,2),
  pitch_variance NUMERIC(10,2),
  pitch_stability TEXT, -- 'stable', 'micro-tremors', 'unstable'
  speech_rate_bpm INTEGER,
  response_latency_ms INTEGER,
  recording_duration_ms INTEGER,
  peak_amplitude NUMERIC(5,4),
  
  -- Advanced Forensics (Jitter/Shimmer/HNR)
  jitter NUMERIC(6,3),
  jitter_absolute NUMERIC(8,4),
  shimmer NUMERIC(6,3),
  harmonics_to_noise NUMERIC(6,2),
  
  -- Stress Analysis (from baseline comparison)
  stress_score INTEGER, -- 0-100
  stress_level TEXT, -- 'normal', 'elevated', 'high', 'critical'
  pitch_deviation NUMERIC(6,2),
  latency_deviation NUMERIC(6,2),
  speech_rate_deviation NUMERIC(6,2),
  jitter_deviation NUMERIC(6,2),
  
  -- Mycroft Analysis Results
  mycroft_verdict TEXT,
  mycroft_forensic_details TEXT,
  was_bluffing BOOLEAN, -- Ground truth if available
  
  -- Metadata
  player_name TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_recordings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Voice recordings are viewable by presenters"
  ON public.voice_recordings
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert voice recordings"
  ON public.voice_recordings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update voice recordings"
  ON public.voice_recordings
  FOR UPDATE
  USING (true);

-- Index for faster queries by room and round
CREATE INDEX idx_voice_recordings_room_round ON public.voice_recordings(room_id, round_number);
CREATE INDEX idx_voice_recordings_player ON public.voice_recordings(player_id);
CREATE INDEX idx_voice_recordings_created ON public.voice_recordings(created_at DESC);

-- Add to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_recordings;