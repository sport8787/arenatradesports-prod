
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can read KB files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can delete KB files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'knowledge-base');
