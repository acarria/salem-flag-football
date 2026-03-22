'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { logger } from '@/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const useAuthenticatedApi = () => {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const request = useCallback(async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;

    let authHeader = {};
    try {
      const token = await getTokenRef.current();
      if (token) {
        authHeader = { Authorization: `Bearer ${token}` };
      }
    } catch (error) {
      logger.error('AuthenticatedAPI: Error getting token:', error);
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
          logger.error('Failed to parse error response:', e);
        }

        const error: any = new Error(errorMessage);
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
  }, []);

  return { request };
};
