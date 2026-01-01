import { BaseApiService } from '../core/base';
import { Team } from '../core/types';

export class TeamApiService extends BaseApiService {
  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>('/team');
  }

  async getTeam(teamId: number): Promise<Team> {
    return this.request<Team>(`/team/${teamId}`);
  }
}
