ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tutorial_read_at timestamp with time zone;