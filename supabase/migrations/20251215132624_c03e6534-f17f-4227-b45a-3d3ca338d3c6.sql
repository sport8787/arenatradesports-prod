-- Change host_id from uuid to text to support session_id strings
ALTER TABLE public.rooms 
ALTER COLUMN host_id TYPE text;