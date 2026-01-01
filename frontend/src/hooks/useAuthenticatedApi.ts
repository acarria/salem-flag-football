import { useAuthContext } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useAuthenticatedApi = () => {
  const { getAuthToken } = useAuthContext();

  const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get authentication token
    let authHeader = {};
    try {
      const token = await getAuthToken();
      console.log('AuthenticatedAPI: Token retrieved', token ? 'Token exists' : 'No token');
      if (token) {
        authHeader = { 'Authorization': `Bearer ${token}` };
        console.log('AuthenticatedAPI: Authorization header set');
      } else {
        console.log('AuthenticatedAPI: No token available');
      }
    } catch (error) {
      console.error('AuthenticatedAPI: Error getting token:', error);
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
  };

  return { request };
};
