'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { logger } from '@/utils/logger';
import { parseApiErrorResponse, throwApiError } from '@/utils/errors';

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
        const { errorMessage, errorData } = await parseApiErrorResponse(response);
        throwApiError(errorMessage, response.status, response.statusText, errorData);
      }

      return await response.json();
    } catch (error) {
      logger.error('API request error:', error);
      throw error;
    }
  }, []);

  return { request };
};
