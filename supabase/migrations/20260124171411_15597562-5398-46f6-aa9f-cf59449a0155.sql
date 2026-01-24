-- Create storage bucket for video recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-video', 'game-video', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to game-video bucket
CREATE POLICY "Game videos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-video');

-- Allow anyone to upload videos
CREATE POLICY "Anyone can upload game videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game-video');

-- Allow anyone to update their videos
CREATE POLICY "Anyone can update game videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'game-video');

-- Allow deletion of old videos
CREATE POLICY "Anyone can delete game videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'game-video');

-- Add video-related columns to voice_recordings table
ALTER TABLE public.voice_recordings
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS facial_analysis_json jsonb,
ADD COLUMN IF NOT EXISTS eye_gaze_dominant text,
ADD COLUMN IF NOT EXISTS micro_expressions_detected text[],
ADD COLUMN IF NOT EXISTS facial_stress_score numeric,
ADD COLUMN IF NOT EXISTS pnl_access_type text,
ADD COLUMN IF NOT EXISTS combined_suspicion_score numeric;