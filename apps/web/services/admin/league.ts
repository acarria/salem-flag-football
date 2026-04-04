import { BaseApiService } from '../core/base';
import {
  League,
  LeagueCreateRequest,
  LeagueUpdateRequest,
  LeagueStats,
  PublicStanding,
  LeagueSchedule,
} from '@salem/types';

export class LeagueApiService extends BaseApiService {
  async getPublicLeagues(): Promise<League[]> {
    return this.request<League[]>('/league/public/leagues');
  }

  async getLeagueById(leagueId: string): Promise<League> {
    return this.request<League>(`/league/${leagueId}`);
  }

  async getLeagueStandings(leagueId: string): Promise<PublicStanding[]> {
    return this.request<PublicStanding[]>(`/league/${leagueId}/standings`);
  }

  async getLeaguePublicSchedule(leagueId: string): Promise<LeagueSchedule> {
    return this.request<LeagueSchedule>(`/league/${leagueId}/schedule`);
  }

  async createLeague(leagueData: LeagueCreateRequest): Promise<League> {
    return this.request<League>('/admin/leagues', {
      method: 'POST',
      body: JSON.stringify(leagueData),
    });
  }

  async getAllLeagues(): Promise<League[]> {
    return this.request<League[]>('/admin/leagues');
  }

  async updateLeague(leagueId: string, leagueData: LeagueUpdateRequest): Promise<League> {
    return this.request<League>(`/admin/leagues/${leagueId}`, {
      method: 'PUT',
      body: JSON.stringify(leagueData),
    });
  }

  async deleteLeague(leagueId: string): Promise<void> {
    await this.request<void>(`/admin/leagues/${leagueId}`, {
      method: 'DELETE',
    });
  }

  async getLeagueStats(leagueId: string): Promise<LeagueStats> {
    return this.request<LeagueStats>(`/admin/leagues/${leagueId}/stats`);
  }
}
