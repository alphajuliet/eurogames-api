export interface Env {
  DB: D1Database;
  API_KEYS?: string;
  REQUIRE_AUTH?: string;
}

export interface Game {
  id: number;
  name: string;
  yearPublished: number;
  complexity: number;
  playingTime: number;
  mechanic: string;
  category: string;
  maxPlayers: number;
  minPlayers: number;
  rating: number;
  ranking: number;
  retrieved: string;
}

export interface GameNotes {
  id: number;
  status: string;
  platform: string;
  uri: string;
  comment: string;
}

export interface GameWithNotes extends Game {
  notes: GameNotes;
  stats?: GameStats;
}

export interface GameStats {
  totalPlays: number;
  lastPlayed?: string;
  daysSinceLastPlayed?: number;
  wins: Record<string, number>;
}

export interface PlayRecord {
  id?: number;
  date: string;
  gameId: number;
  gameName?: string;
  winner: string;
  scores: string;
  comment?: string;
}

export interface WinnerStats {
  gameId: number;
  gameName: string;
  totalGames: number;
  andrew: number;
  trish: number;
  draw: number;
}

export interface OverallTotals {
  totalGames: number;
  players: Record<string, number>;
}

export interface LastPlayedGame {
  id: number;
  name: string;
  lastPlayed: string;
  daysSince: number;
  games: number;
}

export interface GameListParams {
  status?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  search?: string;
}

export interface PlaysParams {
  gameId?: number;
  winner?: string;
  limit?: number;
  offset?: number;
  since?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface APIResponse<T = any> {
  data?: T;
  error?: ErrorResponse['error'];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export type GameStatus = 'Playing' | 'Inbox' | 'Completed' | 'Sold' | 'Wishlisted';
export type OutputFormat = 'json' | 'table' | 'plain' | 'edn';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type Permission = 'read' | 'write' | 'delete' | 'export' | 'query';

export interface AuthContext {
  authenticated: boolean;
  permissions: Permission[];
  keyId?: string;
}

export interface RouteHandler {
  (request: Request, env: Env, params?: Record<string, string>, auth?: AuthContext): Promise<Response>;
}