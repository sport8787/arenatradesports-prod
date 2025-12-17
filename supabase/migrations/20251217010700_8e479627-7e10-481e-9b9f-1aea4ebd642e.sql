-- Add column for audio justification URL
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS current_audio_url text;

-- Create storage bucket for game audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-audio', 'game-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload audio files to the game-audio bucket
CREATE POLICY "Anyone can upload audio files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'game-audio');

-- Allow anyone to read audio files from the game-audio bucket
CREATE POLICY "Audio files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-audio');

-- Allow anyone to delete audio files
CREATE POLICY "Anyone can delete audio files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'game-audio');