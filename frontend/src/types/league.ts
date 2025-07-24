import { TournamentFormat, GameFormat } from './common';

export interface League {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  num_weeks: number;
  format: GameFormat;
  tournament_format: TournamentFormat;
  regular_season_weeks?: number;
  playoff_weeks?: number;
  swiss_rounds?: number;
  swiss_pairing_method?: string;
  compass_draw_rounds?: number;
  playoff_teams?: number;
  playoff_format?: string;
  game_duration: number;
  games_per_week: number;
  max_teams?: number;
  min_teams: number;
  registration_deadline?: string;
  registration_fee?: number;
  settings?: any;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  registered_players_count: number;
  registered_teams_count: number;
}

export interface LeagueCreateRequest {
  name: string;
  description?: string;
  start_date: string;
  num_weeks: number;
  format: GameFormat;
  tournament_format: TournamentFormat;
  regular_season_weeks?: number;
  playoff_weeks?: number;
  swiss_rounds?: number;
  swiss_pairing_method?: string;
  compass_draw_rounds?: number;
  playoff_teams?: number;
  playoff_format?: string;
  game_duration: number;
  games_per_week: number;
  max_teams?: number;
  min_teams: number;
  registration_deadline?: string;
  registration_fee?: number;
  settings?: any;
}

export interface LeagueUpdateRequest {
  name?: string;
  description?: string;
  start_date?: string;
  num_weeks?: number;
  format?: GameFormat;
  tournament_format?: TournamentFormat;
  regular_season_weeks?: number;
  playoff_weeks?: number;
  swiss_rounds?: number;
  swiss_pairing_method?: string;
  compass_draw_rounds?: number;
  playoff_teams?: number;
  playoff_format?: string;
  game_duration?: number;
  games_per_week?: number;
  max_teams?: number;
  min_teams?: number;
  registration_deadline?: string;
  registration_fee?: number;
  settings?: any;
  is_active?: boolean;
}

export interface LeagueStats {
  league_id: number;
  total_players: number;
  total_teams: number;
  registration_status: string;
  days_until_start: number;
  days_until_deadline?: number;
}

export interface Team {
  id: number;
  name: string;
  color?: string;
  league_id: number;
}

export interface Standing {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Game {
  week: number;
  home: string;
  away: string;
  date: string;
  time: string;
  location: string;
} 