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
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
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
            if (errorData.detail) {
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
  }
}
