-- Add game_mode column to rooms table
ALTER TABLE public.rooms 
ADD COLUMN game_mode text NOT NULL DEFAULT 'online';

-- Add constraint to ensure valid values
ALTER TABLE public.rooms 
ADD CONSTRAINT rooms_game_mode_check 
CHECK (game_mode IN ('online', 'presencial'));