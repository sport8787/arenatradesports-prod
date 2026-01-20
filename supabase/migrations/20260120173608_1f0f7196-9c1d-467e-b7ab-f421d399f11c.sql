-- Adicionar campo 'mode' na tabela rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'classic' CHECK (mode IN ('classic', 'horus', 'presenter'));

-- Adicionar campo 'role' na tabela players
ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player' CHECK (role IN ('presenter', 'player', 'jury'));

-- Nova tabela para eventos da sala
CREATE TABLE IF NOT EXISTS room_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para validação de Maleta Fundador
CREATE TABLE IF NOT EXISTS founder_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  case_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_room_events_room_id ON room_events(room_id);
CREATE INDEX IF NOT EXISTS idx_room_events_created_at ON room_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_cases_user_id ON founder_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_cases_code ON founder_cases(case_code);

-- Enable RLS
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_cases ENABLE ROW LEVEL SECURITY;

-- RLS policies para room_events
CREATE POLICY "Room events are viewable by room participants" ON room_events
FOR SELECT USING (true);

CREATE POLICY "Presenters can insert room events" ON room_events
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can delete room events" ON room_events
FOR DELETE USING (true);

-- RLS policies para founder_cases
CREATE POLICY "Users can view their own founder case" ON founder_cases
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage founder cases" ON founder_cases
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime para room_events
ALTER PUBLICATION supabase_realtime ADD TABLE room_events;