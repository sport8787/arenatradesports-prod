-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Allow DELETE on rooms table (needed for cleanup)
CREATE POLICY "System can delete old rooms" 
ON public.rooms 
FOR DELETE 
USING (true);

-- Allow DELETE on votes for cleanup
CREATE POLICY "System can delete votes" 
ON public.votes 
FOR DELETE 
USING (true);