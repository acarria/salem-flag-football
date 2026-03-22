'use client';

import React, { useState, useEffect, useRef, Component, ReactNode, ErrorInfo } from 'react';
import Link from 'next/link';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import ProfileCompletionModal from '@/components/modals/ProfileCompletionModal';
import { invitationService, PendingInvitation } from '@/services/public/invitations';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
import { isHttpStatus } from '@/utils/errors';
import { UserProfile } from '@salem/types';
import { logger } from '@/utils/logger';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-primary">
          <div className="text-center">
            <div className="text-white text-lg font-semibold mb-2">Something went wrong</div>
            <div className="text-[#A0A0A0] text-sm mb-4">Please refresh the page to continue.</div>
            <button
              onClick={() => window.location.reload()}
              className="bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { request } = useAuthenticatedApi();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  const requestRef = useRef(request);
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    requestRef.current = request;
    getTokenRef.current = getToken;
  }, [request, getToken]);

  useEffect(() => {
    const checkProfile = async () => {
      if (isSignedIn && isLoaded && userId) {
        try {
          const profile = await requestRef.current<UserProfile>('/user/me');
          if (profile) {
            setIsProfileComplete(true);
          } else {
            setShowProfileModal(true);
          }
        } catch (err: unknown) {
          if (isHttpStatus(err, 404)) {
            setShowProfileModal(true);
          } else {
            logger.error('Failed to check profile:', err);
            setShowProfileModal(true);
          }
        }

        try {
          const authToken = await getTokenRef.current();
          if (authToken) {
            const invites = await invitationService.getPendingInvitations(authToken);
            setPendingInvitations(invites);
          }
        } catch (err) {
          logger.error('Failed to load invitations:', err);
        }
      }
    };

    checkProfile();
  }, [isSignedIn, isLoaded, userId]);

  const handleProfileComplete = async (profileData: any) => {
    if (userId) {
      try {
        const userProfile: UserProfile = {
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone,
          dateOfBirth: profileData.dateOfBirth,
          gender: profileData.gender,
          communicationsAccepted: profileData.communicationsAccepted,
        };
        await request('/user/me', { method: 'PUT', body: JSON.stringify(userProfile) });
        setIsProfileComplete(true);
        setShowProfileModal(false);
      } catch (err) {
        logger.error('Failed to save profile:', err);
      }
    }
  };

  const handleProfileCancel = async () => {
    try {
      await signOut();
      setIsProfileComplete(false);
      setShowProfileModal(false);
    } catch (err) {
      logger.error('Failed to sign out:', err);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-accent text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-primary">
        {isSignedIn && pendingInvitations.length > 0 && (
          <div className="bg-green-700 text-white text-center py-2 px-4 text-sm">
            You have {pendingInvitations.length} pending group invitation
            {pendingInvitations.length > 1 ? 's' : ''}.{' '}
            <Link href={`/invite/${pendingInvitations[0].token}`} className="underline font-semibold">
              View invitation
            </Link>
          </div>
        )}

        {children}

        {isSignedIn && !isProfileComplete && (
          <ProfileCompletionModal
            isOpen={showProfileModal}
            onComplete={handleProfileComplete}
            onCancel={handleProfileCancel}
            clerkUser={user}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
