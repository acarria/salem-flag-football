'use client';

import { useAuth } from '@clerk/nextjs';
import { useAdmin } from '@/hooks/useAdmin';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || isAdminLoading) return;
    if (!isSignedIn || !isAdmin) {
      router.replace('/');
    }
  }, [isLoaded, isAdminLoading, isSignedIn, isAdmin, router]);

  if (!isLoaded || isAdminLoading) return null;
  if (!isSignedIn || !isAdmin) return null;

  return <>{children}</>;
}
