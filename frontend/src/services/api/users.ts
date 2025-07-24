import { UserProfile, ProfileData } from '../../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class UsersApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get authentication token from Clerk
    let authHeader = {};
    try {
      // For now, we'll skip authentication for user endpoints
      // This is a temporary workaround - in production, you'd need proper JWT handling
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

  // User profile endpoints
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      return await this.request<UserProfile>('/user/profile');
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  async updateUserProfile(profileData: ProfileData): Promise<UserProfile> {
    return this.request<UserProfile>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async createUserProfile(profileData: ProfileData): Promise<UserProfile> {
    return this.request<UserProfile>('/user/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }
}

export const usersApi = new UsersApiService(); 