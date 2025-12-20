-- Create storage bucket for audio cache
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-cache', 'audio-cache', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to cached audio
CREATE POLICY "Public read access for audio cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-cache');

-- Allow service role to upload audio
CREATE POLICY "Service role can upload to audio cache"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-cache');

-- Allow service role to delete old cache entries
CREATE POLICY "Service role can delete from audio cache"
ON storage.objects FOR DELETE
USING (bucket_id = 'audio-cache');