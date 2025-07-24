import { AdminConfig, AdminConfigCreateRequest, AdminConfigUpdateRequest } from '../../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class AdminApiService {
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

  // Admin management endpoints
  async getAdminConfigs(): Promise<AdminConfig[]> {
    return this.request<AdminConfig[]>('/admin/admins');
  }

  async addAdminEmail(email: string, role: string = 'admin'): Promise<AdminConfig> {
    return this.request<AdminConfig>('/admin/admins', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async updateAdminConfig(adminId: number, configData: AdminConfigUpdateRequest): Promise<AdminConfig> {
    return this.request<AdminConfig>(`/admin/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
  }

  async removeAdminEmail(adminId: number): Promise<any> {
    return this.request<any>(`/admin/admins/${adminId}`, {
      method: 'DELETE',
    });
  }
}

export const adminApi = new AdminApiService(); 