import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useAuthenticatedApi } from './useAuthenticatedApi';

export const useAdmin = () => {
  const { isSignedIn } = useAuth();
  const { request } = useAuthenticatedApi();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isSignedIn) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const result = await request<{ is_admin: boolean }>('/admin/me');
        setIsAdmin(result.is_admin);
      } catch {
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [isSignedIn, request]);

  return { isAdmin, isLoading };
};
