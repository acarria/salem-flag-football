import { BaseApiService } from '../core/base';
import { 
  AdminConfig, 
  AdminConfigCreateRequest, 
  AdminConfigUpdateRequest,
  LeagueMember,
  TeamGenerationRequest,
  TeamGenerationResponse,
  ScheduleGenerationRequest,
  ScheduleGenerationResponse,
  LeagueSchedule
} from '../core/types';

export class AdminApiService extends BaseApiService {
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

  // Team Generation
  async generateTeams(leagueId: number, request: TeamGenerationRequest): Promise<TeamGenerationResponse> {
    return this.request<TeamGenerationResponse>(`/admin/leagues/${leagueId}/generate-teams`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Schedule Generation
  async generateScheduleForLeague(leagueId: number, request: ScheduleGenerationRequest): Promise<ScheduleGenerationResponse> {
    return this.request<ScheduleGenerationResponse>(`/admin/leagues/${leagueId}/generate-schedule`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getLeagueSchedule(leagueId: number): Promise<LeagueSchedule> {
    return this.request<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
  }

  // Member Management
  async getLeagueMembers(leagueId: number): Promise<LeagueMember[]> {
    return this.request<LeagueMember[]>(`/admin/leagues/${leagueId}/members`);
  }

  // Fake Data Creation
  async addFakeData(leagueId: number): Promise<any> {
    return this.request<any>(`/admin/leagues/${leagueId}/add-fake-data`, {
      method: 'POST',
    });
  }

  // Legacy admin endpoints (for backward compatibility)
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
}
