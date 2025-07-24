import { League, LeagueCreateRequest, LeagueUpdateRequest, LeagueStats, Standing, Game } from '../../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class LeaguesApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
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

  // Public league endpoints
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

  // Admin league endpoints
  async getAllLeagues(): Promise<League[]> {
    return this.request<League[]>('/admin/leagues');
  }

  async getLeagueDetails(leagueId: number): Promise<League> {
    return this.request<League>(`/admin/leagues/${leagueId}`);
  }

  async createLeague(leagueData: LeagueCreateRequest): Promise<League> {
    return this.request<League>('/admin/leagues', {
      method: 'POST',
      body: JSON.stringify(leagueData),
    });
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
}

export const leaguesApi = new LeaguesApiService(); 