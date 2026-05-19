// Types compartilhados do Modo Blackjack Ao Vivo
export type TableType = 'classic' | 'infinity';
export type Penetration = 0.60 | 0.75 | 0.85;
export type DeckCount = 4 | 6 | 8;
export type LiveBettingSystem = 'martingale' | 'kelly' | 'hybrid';
export type RoundResult = 'win' | 'loss' | 'push' | 'blackjack';

export type PositionState = 'active' | 'empty' | 'mine';

export interface SessionConfig {
  tableType: TableType;
  decks: DeckCount;
  penetration: Penetration;
  baseBet: number;
  bettingSystem: LiveBettingSystem;
  initialBankroll: number;
  maxRedStreak: number;
}

export interface RoundRecord {
  id: number;
  bet: number;
  result: RoundResult;
  profit: number;
  trueCount: number;
  bankrollAfter: number;
  timestamp: number;
}

export interface ShuffleEvent {
  at: number; // timestamp
  roundsBefore: number; // rodadas desde o último shuffle (ou início)
}

export interface LiveSessionState {
  config: SessionConfig;
  bankroll: number;
  currentBet: number;
  redStreak: number;
  paused: boolean;
  pauseReason?: string;
  positions: Record<number, PositionState>; // 1..7 (apenas clássica)
  myPosition: number; // 1..7 — clássica
  count: {
    running: number;
    cardsSeen: number;
    history: number[]; // TCs por rodada (p/ média)
  };
  shuffles: ShuffleEvent[];
  history: RoundRecord[];
  startedAt: number;
}

// Cartas do teclado virtual (sem naipe). Encode com sufixo "x"
// para compatibilizar com helpers existentes que fazem card.slice(0,-1).
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];
export const toCard = (r: Rank) => `${r}x`;
