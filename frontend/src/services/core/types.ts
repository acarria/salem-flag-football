// League Types
export type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
export type GameFormat = '7v7' | '6v6' | '5v5';

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

export interface League {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  num_weeks: number;
  format: string;
  tournament_format: string;
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
  format: string;
  tournament_format: string;
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
  format?: string;
  tournament_format?: string;
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

// Admin Types
export interface AdminConfig {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminConfigCreateRequest {
  email: string;
  role: string;
}

export interface AdminConfigUpdateRequest {
  role?: string;
  is_active?: boolean;
}

export interface User {
  clerk_user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  registration_status: string;
  created_at: string;
  leagues_count: number;
}

export interface PaginatedUserResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LeagueMember {
  id: number;
  player_id: number;
  first_name: string;
  last_name: string;
  email: string;
  group_id?: number;
  group_name?: string;
  team_id?: number;
  team_name?: string;
  registration_status: string;
  payment_status: string;
  waiver_status: string;
  created_at: string;
}

export interface TeamGenerationRequest {
  teams_count?: number;
  max_players_per_team?: number;
  min_players_per_team?: number;
  team_names?: string[];
  team_colors?: string[];
}

export interface TeamGenerationResponse {
  teams_created: number;
  players_assigned: number;
  groups_kept_together: number;
  groups_split: number;
  team_details: Array<{
    team_id: number;
    team_name: string;
    team_color: string;
    player_count: number;
    players: Array<{
      player_id: number;
      first_name: string;
      last_name: string;
      group_id?: number;
    }>;
  }>;
}

export interface ScheduleGenerationRequest {
  start_date?: string;
  game_duration?: number;
  games_per_week?: number;
  time_slots?: string[];
}

export interface ScheduleGenerationResponse {
  games_created: number;
  weeks_scheduled: number;
  schedule_details: Array<{
    week: number;
    date: string;
    time: string;
    team1_id: number;
    team2_id: number;
    game_datetime: string;
    duration_minutes: number;
    phase?: string;
  }>;
}

export interface LeagueSchedule {
  league_id: number;
  league_name: string;
  total_games: number;
  schedule_by_week: Record<number, Array<{
    game_id: number;
    team1_id: number;
    team1_name: string;
    team2_id: number;
    team2_name: string;
    date: string;
    time: string;
    datetime: string;
    duration_minutes: number;
    status: string;
    phase?: string;
    team1_score?: number;
    team2_score?: number;
    winner_id?: number;
  }>>;
}

// User Types
export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  communicationsAccepted: boolean;
  registrationStatus: 'registered' | 'pending' | 'not_registered';
  teamId?: number;
  groupName?: string;
  registrationDate?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  waiverStatus?: 'pending' | 'signed' | 'expired';
  leagueId?: number;
}

// Registration Types
export interface RegistrationData {
  type: 'solo' | 'group';
  solo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    termsAccepted: boolean;
    communicationsAccepted: boolean;
  };
  group?: {
    name: string;
    players: Array<{
      firstName: string;
      lastName: string;
      email: string;
    }>;
  };
}
