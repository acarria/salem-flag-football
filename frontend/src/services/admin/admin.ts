import { BaseApiService } from '../core/base';
import {
  AdminConfig,
  AdminConfigCreateRequest,
  AdminConfigUpdateRequest,
  PaginatedUserResponse,
  LeagueMember,
  Team,
  TeamGenerationRequest,
  TeamGenerationResponse,
  ScheduleGenerationRequest,
  ScheduleGenerationResponse,
  LeagueSchedule,
  GameUpdateRequest
} from '../core/types';

export class AdminApiService extends BaseApiService {
  // Admin Management
  async getAdminConfigs(): Promise<AdminConfig[]> {
    return this.request<AdminConfig[]>('/admin/admins');
  }

  // User Management
  async getAllUsers(page: number = 1, pageSize: number = 25): Promise<PaginatedUserResponse> {
    return this.request<PaginatedUserResponse>(`/admin/users?page=${page}&page_size=${pageSize}`);
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

  async removeAdminEmail(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/admins/${email}`, {
      method: 'DELETE',
    });
  }

  // Team Generation
  async generateTeams(leagueId: string, request: TeamGenerationRequest): Promise<TeamGenerationResponse> {
    return this.request<TeamGenerationResponse>(`/admin/leagues/${leagueId}/generate-teams`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Schedule Generation
  async generateScheduleForLeague(leagueId: string, request: ScheduleGenerationRequest): Promise<ScheduleGenerationResponse> {
    return this.request<ScheduleGenerationResponse>(`/admin/leagues/${leagueId}/generate-schedule`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getLeagueSchedule(leagueId: string): Promise<LeagueSchedule> {
    return this.request<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
  }

  async updateGame(leagueId: string, gameId: string, data: GameUpdateRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/leagues/${leagueId}/games/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Member Management
  async getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
    return this.request<LeagueMember[]>(`/admin/leagues/${leagueId}/members`);
  }

  async getLeagueTeams(leagueId: string): Promise<Team[]> {
    return this.request<Team[]>(`/admin/leagues/${leagueId}/teams`);
  }

  async removeAdminEmailConfig(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/admins/${email}`, {
      method: 'DELETE',
    });
  }
}
