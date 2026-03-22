'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import BaseLayout from '@/components/layout/BaseLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
import LeaguesSection from './components/LeaguesSection';
import FieldsSection from './components/FieldsSection';
import UsersSection from './components/UsersSection';
import AdminsSection from './components/AdminsSection';

export default function AdminPage() {
  const { isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const currentUserEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const router = useRouter();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSignedIn) { router.replace('/'); return; }
    if (isAdminLoading) return;
    if (!isAdmin) { router.replace('/'); return; }
    setReady(true);
  }, [isSignedIn, isAdmin, isAdminLoading, router]);

  if (!isSignedIn || !ready) return null;

  return (
    <BaseLayout>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-16">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Admin Dashboard</h1>
          <p className="text-sm text-[#6B6B6B]">Manage leagues, fields, users, and admins</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-4">&#x2715;</button>
          </div>
        )}
        {success && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent text-sm flex justify-between">
            {success}
            <button onClick={() => setSuccess(null)} className="text-accent/60 hover:text-accent ml-4">&#x2715;</button>
          </div>
        )}

        <LeaguesSection
          authenticatedRequest={authenticatedRequest}
          setError={setError}
          setSuccess={setSuccess}
        />

        <FieldsSection
          authenticatedRequest={authenticatedRequest}
          setError={setError}
          setSuccess={setSuccess}
        />

        <UsersSection authenticatedRequest={authenticatedRequest} />

        <AdminsSection
          authenticatedRequest={authenticatedRequest}
          currentUserEmail={currentUserEmail}
          setError={setError}
          setSuccess={setSuccess}
        />
      </div>
    </BaseLayout>
  );
}
