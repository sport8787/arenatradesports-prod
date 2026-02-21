-- Add RLS policies for poker-knowledge-base bucket
CREATE POLICY "Authenticated users can upload to poker-knowledge-base"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'poker-knowledge-base');

CREATE POLICY "Authenticated users can read from poker-knowledge-base"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'poker-knowledge-base');

CREATE POLICY "Authenticated users can update poker-knowledge-base"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'poker-knowledge-base');

CREATE POLICY "Authenticated users can delete from poker-knowledge-base"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'poker-knowledge-base');