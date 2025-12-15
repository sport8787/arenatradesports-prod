-- Add bluffcoins column to players table
ALTER TABLE public.players 
ADD COLUMN bluffcoins integer NOT NULL DEFAULT 1000;