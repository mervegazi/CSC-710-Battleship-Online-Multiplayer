// src/types/index.ts — matches tech doc Section 13.2

// Lobby & Presence types (tech doc Section 8.2)
export type LobbyStatus = 'idle' | 'in_queue' | 'hosting_table' | 'in_game';

export interface PresenceState {
  user_id: string;
  display_name: string;
  status: LobbyStatus;
  joined_at: string;
}

export type GameStatus = 'setup' | 'in_progress' | 'finished' | 'abandoned';
export type MoveResult = 'hit' | 'miss' | 'sunk';
export type TableStatus = 'waiting' | 'full' | 'in_game' | 'closed';
export type RequestStatus = 'pending' | 'accepted' | 'rejected';
export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export type Orientation = 'horizontal' | 'vertical';
export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  total_games: number;
  wins: number;
  losses: number;
  created_at: string;
  last_seen: string;
}

export interface Game {
  id: string;
  table_id: string | null;
  status: GameStatus;
  current_turn: string | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  board: BoardState;
  ready: boolean;
  player_number: 1 | 2;
  last_heartbeat: string;
}

export interface BoardState {
  ships: Ship[];
}

export interface Ship {
  type: ShipType;
  size: number;
  cells: Coordinate[];
  orientation: Orientation;
  sunk: boolean;
}

export interface Coordinate {
  x: number; // 0-9 (columns A-J)
  y: number; // 0-9 (rows 1-10)
}

export interface Move {
  id: string;
  game_id: string;
  player_id: string;
  x: number;
  y: number;
  result: MoveResult;
  sunk_ship: ShipType | null;
  move_number: number;
  created_at: string;
}

export interface Table {
  id: string;
  host_id: string;
  host_name?: string;
  status: TableStatus;
  created_at: string;
}

export interface TableRequest {
  id: string;
  table_id: string;
  requester_id: string;
  requester_name?: string;
  status: RequestStatus;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  channel: string;
  created_at: string;
}
