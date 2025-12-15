-- Create enum types
CREATE TYPE room_status AS ENUM ('lobby', 'question', 'discussion', 'voting', 'result');
CREATE TYPE difficulty_level AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE answer_option AS ENUM ('A', 'B', 'C', 'D');

-- Create questions table (the heart of the game)
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option answer_option NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'Medium',
  mycroft_bluff_suggestion TEXT,
  mycroft_risk_analysis TEXT,
  mycroft_risk_level INT CHECK (mycroft_risk_level >= 0 AND mycroft_risk_level <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pin TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  current_status room_status NOT NULL DEFAULT 'lobby',
  current_question_id UUID REFERENCES public.questions(id),
  current_player_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  avatar_url TEXT,
  is_host BOOLEAN NOT NULL DEFAULT false,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create votes table for tracking player votes
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('believe', 'doubt')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, question_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for questions (public read)
CREATE POLICY "Questions are publicly readable"
ON public.questions FOR SELECT
USING (true);

-- RLS Policies for rooms (public access for game functionality)
CREATE POLICY "Rooms are publicly readable"
ON public.rooms FOR SELECT
USING (true);

CREATE POLICY "Anyone can create rooms"
ON public.rooms FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update rooms"
ON public.rooms FOR UPDATE
USING (true);

-- RLS Policies for players (public access for game functionality)
CREATE POLICY "Players are publicly readable"
ON public.players FOR SELECT
USING (true);

CREATE POLICY "Anyone can join as player"
ON public.players FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update players"
ON public.players FOR UPDATE
USING (true);

CREATE POLICY "Anyone can leave game"
ON public.players FOR DELETE
USING (true);

-- RLS Policies for votes
CREATE POLICY "Votes are publicly readable"
ON public.votes FOR SELECT
USING (true);

CREATE POLICY "Anyone can vote"
ON public.votes FOR INSERT
WITH CHECK (true);

-- Enable Realtime for rooms and players
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- Insert mock questions with Mycroft data
INSERT INTO public.questions (category, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, mycroft_bluff_suggestion, mycroft_risk_analysis, mycroft_risk_level) VALUES
('História', 'Qual imperador romano ficou conhecido por "tocar violino enquanto Roma queimava"?', 'Augusto', 'Nero', 'Calígula', 'Tibério', 'B', 'Easy', 'Fale com confiança sobre Calígula, mencionando sua conhecida loucura e festas extravagantes. Diga que ele adorava música e espetáculos.', '65% dos jogadores erram esta questão, geralmente escolhendo Calígula devido à sua reputação de loucura.', 65),
('Ciências', 'Qual é o único mamífero capaz de voar verdadeiramente?', 'Esquilo Voador', 'Morcego', 'Lêmure Voador', 'Colugo', 'B', 'Easy', 'Argumente que o Esquilo Voador é a resposta, pois ele realmente "voa" entre árvores - diferente do morcego que apenas "plana".', '72% acertam esta questão. Baixo potencial de blefe.', 28),
('Geografia', 'Qual país tem mais fusos horários?', 'Rússia', 'Estados Unidos', 'França', 'China', 'C', 'Hard', 'Mencione a extensão continental da Rússia de forma convincente. Poucos sabem que a França, com seus territórios ultramarinos, possui 12 fusos horários.', '89% erram esta questão escolhendo Rússia. Alto potencial de blefe!', 89),
('Arte', 'Quem pintou "A Noite Estrelada"?', 'Claude Monet', 'Vincent van Gogh', 'Pablo Picasso', 'Salvador Dalí', 'B', 'Easy', 'Conecte a obra ao estilo surrealista de Dalí, mencionando os redemoinhos e a atmosfera onírica como características dele.', '82% acertam. Van Gogh é muito associado a esta obra.', 18),
('Tecnologia', 'Em que ano foi lançado o primeiro iPhone?', '2005', '2006', '2007', '2008', 'C', 'Medium', 'Diga com convicção que foi 2006, pois você "lembra da propaganda" daquele ano. A maioria confunde as datas próximas.', '58% erram, geralmente escolhendo 2006 ou 2008.', 58);