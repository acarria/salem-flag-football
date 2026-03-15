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
        // Try to extract error details from response body
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        let errorData: any = { detail: errorMessage };
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map((e: any) => e.msg).join('; ');
            } else if (errorData.detail) {
              errorMessage = errorData.detail;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else {
            const text = await response.text();
            if (text) {
              errorMessage = text;
              errorData = { detail: text };
            }
          }
        } catch (e) {
          // If we can't parse the response, use the status text
          console.error('Failed to parse error response:', e);
        }
        
        const error: any = new Error(errorMessage);
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  };

  return { request };
};
