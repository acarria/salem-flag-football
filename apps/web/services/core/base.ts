import { ZodSchema } from 'zod';
import { logger } from '@/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
if (process.env.NODE_ENV === 'production' && !API_BASE_URL.startsWith('https://')) {
  throw new Error('NEXT_PUBLIC_API_URL must use HTTPS in production. Current value: ' + API_BASE_URL);
}

interface ApiErrorData {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

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
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        let errorData: ApiErrorData = { detail: errorMessage };

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
          logger.error('Failed to parse error response:', e);
        }

        const error = new Error(errorMessage) as Error & {
          response?: { status: number; statusText: string; data: ApiErrorData };
        };
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      logger.error('API request error:', error);
      throw error;
    }
  }

  protected async requestValidated<T>(
    endpoint: string,
    schema: ZodSchema<T>,
    options: RequestInit = {}
  ): Promise<T> {
    const data = await this.request<unknown>(endpoint, options);
    const result = schema.safeParse(data);
    if (!result.success) {
      logger.error('API response validation failed:', result.error.flatten());
      throw new Error('Unexpected API response format');
    }
    return result.data;
  }
}
