
-- Allow authenticated users to view available (unclaimed) founder cases for validation
CREATE POLICY "Users can view available founder cases"
ON public.founder_cases
FOR SELECT
USING (
  user_id IS NULL AND is_active = true
);

-- Allow authenticated users to claim/activate an available founder case
CREATE POLICY "Users can claim available founder cases"
ON public.founder_cases
FOR UPDATE
USING (
  user_id IS NULL AND is_active = true
)
WITH CHECK (
  auth.uid() = user_id
);
