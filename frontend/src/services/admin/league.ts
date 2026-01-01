import { BaseApiService } from '../core/base';
import { 
  League, 
  LeagueCreateRequest, 
  LeagueUpdateRequest, 
  LeagueStats,
  Standing, 
  Game 
} from '../core/types';

export class LeagueApiService extends BaseApiService {
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

  async getPublicLeagues(): Promise<League[]> {
    return this.request<League[]>('/league/public/leagues');
  }

  async getLeagueInfo(): Promise<any> {
    return this.request<any>('/league/info');
  }

  async getLeagueRules(): Promise<any> {
    return this.request<any>('/league/rules');
  }

  // Admin league endpoints
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
}
