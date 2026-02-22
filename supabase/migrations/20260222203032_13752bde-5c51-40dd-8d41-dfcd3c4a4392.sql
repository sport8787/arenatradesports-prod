
-- Create storage bucket for sports knowledge base
INSERT INTO storage.buckets (id, name, public) VALUES ('sports-knowledge-base', 'sports-knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to sports-knowledge-base
CREATE POLICY "Authenticated users can upload sports KB files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sports-knowledge-base' AND auth.role() = 'authenticated');

-- Authenticated users can read sports KB files
CREATE POLICY "Authenticated users can read sports KB files"
ON storage.objects FOR SELECT
USING (bucket_id = 'sports-knowledge-base' AND auth.role() = 'authenticated');

-- Authenticated users can delete sports KB files
CREATE POLICY "Authenticated users can delete sports KB files"
ON storage.objects FOR DELETE
USING (bucket_id = 'sports-knowledge-base' AND auth.role() = 'authenticated');

-- Authenticated users can update sports KB files (for upsert)
CREATE POLICY "Authenticated users can update sports KB files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'sports-knowledge-base' AND auth.role() = 'authenticated');
