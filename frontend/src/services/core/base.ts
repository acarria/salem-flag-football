const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Base API service class
export class BaseApiService {
  protected baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Get authentication token from Clerk
    let authHeader = {};
    try {
      const { useAuth } = await import('@clerk/clerk-react');
      // Note: This is a simplified approach. In a real app, you'd need to handle this differently
      // since hooks can't be called inside regular functions. For now, we'll proceed without auth
      // for non-admin endpoints and handle admin auth separately.
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
}
