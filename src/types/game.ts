export type RoomStatus = 'lobby' | 'question' | 'discussion' | 'voting' | 'result';

export interface Question {
  id: string;
  category: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  mycroft_bluff_suggestion: string | null;
  mycroft_risk_analysis: string | null;
  mycroft_risk_level: number | null;
}

export interface Room {
  id: string;
  pin: string;
  host_id: string;
  current_status: RoomStatus;
  current_question_id: string | null;
  current_player_index: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  bluffcoins: number;
  avatar_url: string | null;
  is_host: boolean;
  session_id: string;
  created_at: string;
}

export interface Vote {
  id: string;
  room_id: string;
  question_id: string;
  player_id: string;
  vote_type: 'believe' | 'doubt';
  created_at: string;
}

export interface GameState {
  room: Room | null;
  players: Player[];
  currentQuestion: Question | null;
  currentPlayer: Player | null;
  myPlayer: Player | null;
  votes: Vote[];
}
