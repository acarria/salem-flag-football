const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Types for API responses
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

// API service class
class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Get authentication token from Clerk
    let authHeader = {};
    try {
      // For now, we'll skip authentication for admin endpoints
      // This is a temporary workaround - in production, you'd need proper JWT handling
      if (endpoint.startsWith('/admin/')) {
        console.log('Admin endpoint detected - using mock data for now');
        // Return mock data for admin endpoints until authentication is properly implemented
        if (endpoint === '/admin/leagues') {
          return [] as any;
        }
        if (endpoint === '/admin/admins') {
          return [{ id: 1, email: 'alexcarria1@gmail.com', role: 'super_admin', is_active: true, created_at: new Date().toISOString() }] as any;
        }
      }
    } catch (error) {
      console.log('No authentication token available');
    }
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // League endpoints
  async getStandings(): Promise<Standing[]> {
    return this.request<Standing[]>('/league/standings');
  }

  async getSchedule(): Promise<Game[]> {
    return this.request<Game[]>('/league/schedule');
  }

  async getActiveLeagues(): Promise<League[]> {
    return this.request<League[]>('/league/active');
  }

  async getLeagueInfo(): Promise<any> {
    return this.request<any>('/league/info');
  }

  async getLeagueRules(): Promise<any> {
    return this.request<any>('/league/rules');
  }

  // User profile endpoints
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await this.request<UserProfile>(`/user/profile/${userId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>(`/user/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  // Registration endpoints
  async registerPlayer(registrationData: RegistrationData): Promise<any> {
    return this.request<any>('/registration/player', {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }

  async registerGroup(registrationData: RegistrationData): Promise<any> {
    return this.request<any>('/registration/group', {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }

  // Team endpoints
  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>('/team');
  }

  async getTeam(teamId: number): Promise<Team> {
    return this.request<Team>(`/team/${teamId}`);
  }

  // Admin endpoints (if user has admin privileges)
  async getAdminDashboard(): Promise<any> {
    return this.request<any>('/admin/dashboard');
  }

  async generateSchedule(): Promise<any> {
    return this.request<any>('/admin/schedule/generate', {
      method: 'POST',
    });
  }

  async randomizeTeams(): Promise<any> {
    return this.request<any>('/admin/teams/randomize', {
      method: 'POST',
    });
  }

  // Admin League Management
  async createLeague(leagueData: LeagueCreateRequest): Promise<League> {
    return this.request<League>('/admin/leagues', {
      method: 'POST',
      body: JSON.stringify(leagueData),
    });
  }

  async getAllLeagues(): Promise<League[]> {
    return this.request<League[]>('/admin/leagues');
  }

  async getLeagueDetails(leagueId: number): Promise<League> {
    return this.request<League>(`/admin/leagues/${leagueId}`);
  }

  async updateLeague(leagueId: number, leagueData: LeagueUpdateRequest): Promise<League> {
    return this.request<League>(`/admin/leagues/${leagueId}`, {
      method: 'PUT',
      body: JSON.stringify(leagueData),
    });
  }

  async deleteLeague(leagueId: number): Promise<any> {
    return this.request<any>(`/admin/leagues/${leagueId}`, {
      method: 'DELETE',
    });
  }

  async getLeagueStats(leagueId: number): Promise<LeagueStats> {
    return this.request<LeagueStats>(`/admin/leagues/${leagueId}/stats`);
  }

  // Admin Management
  async getAdminConfigs(): Promise<AdminConfig[]> {
    return this.request<AdminConfig[]>('/admin/admins');
  }

  async addAdminEmail(adminData: AdminConfigCreateRequest): Promise<AdminConfig> {
    return this.request<AdminConfig>('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  }

  async updateAdminConfig(email: string, adminData: AdminConfigUpdateRequest): Promise<AdminConfig> {
    return this.request<AdminConfig>(`/admin/admins/${email}`, {
      method: 'PUT',
      body: JSON.stringify(adminData),
    });
  }

  async removeAdminEmail(email: string): Promise<any> {
    return this.request<any>(`/admin/admins/${email}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 