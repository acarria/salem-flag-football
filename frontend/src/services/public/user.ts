import { BaseApiService } from '../core/base';
import { UserProfile } from '../core/types';

export class UserApiService extends BaseApiService {
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

  async checkLeagueRegistration(userId: string, leagueId: string): Promise<{ isRegistered: boolean }> {
    return this.request<{ isRegistered: boolean }>(`/user/profile/${userId}/registered/${leagueId}`);
  }
}
