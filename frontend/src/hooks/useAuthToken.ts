import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

export const useAuthToken = () => {
  const { getToken } = useAuth();

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }, [getToken]);

  return { getAuthToken };
}; 