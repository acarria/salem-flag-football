import React, { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import ProfileCompletionModal from './components/modals/ProfileCompletionModal';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import LeagueAdminPage from './pages/admin/LeagueAdminPage';
import LeaguesPage from './pages/LeaguesPage';
import InvitePage from './pages/InvitePage';
import RulesPage from './pages/RulesPage';
import InfoPage from './pages/InfoPage';
import ContactPage from './pages/ContactPage';
import { UserProfile } from './services';
import { invitationService, PendingInvitation } from './services/public/invitations';
import { useAuthenticatedApi } from './hooks/useAuthenticatedApi';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info);
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

function App() {
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { request } = useAuthenticatedApi();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  // Check if user has completed their profile and load pending invitations
  useEffect(() => {
    const checkProfile = async () => {
      if (isSignedIn && isLoaded && userId) {
        try {
          const profile = await request<UserProfile>('/user/me');
          if (profile) {
            setIsProfileComplete(true);
          } else {
            setShowProfileModal(true);
          }
        } catch (err: any) {
          if (err?.status === 404) {
            setShowProfileModal(true);
          } else {
            console.error('Failed to check profile:', err);
            setShowProfileModal(true);
          }
        }

        // Load pending invitations
        try {
          const authToken = await getToken();
          if (authToken) {
            const invites = await invitationService.getPendingInvitations(authToken);
            setPendingInvitations(invites);
          }
        } catch (err) {
          // Non-fatal — just don't show the banner
          console.error('Failed to load invitations:', err);
        }
      }
    };

    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isLoaded, userId]);

  const handleProfileComplete = async (profileData: any) => {
    if (userId) {
      try {
        // Convert ProfileData to UserProfile format
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
        console.error('Failed to save profile:', err);
        // Do NOT mark profile complete or close modal — let user retry
      }
    }
  };

  const handleProfileCancel = async () => {
    // User cancelled profile completion - remove their session
    try {
      await signOut();
      setIsProfileComplete(false);
      setShowProfileModal(false);
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  // Show loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-accent text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-primary">
            {/* Pending invitation banner */}
            {isSignedIn && pendingInvitations.length > 0 && (
              <div className="bg-green-700 text-white text-center py-2 px-4 text-sm">
                You have {pendingInvitations.length} pending group invitation
                {pendingInvitations.length > 1 ? 's' : ''}.{' '}
                <a href={`/invite/${pendingInvitations[0].token}`} className="underline font-semibold">
                  View invitation
                </a>
              </div>
            )}

            {/* Routes */}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={isSignedIn ? <AdminPage /> : <Navigate to="/" replace />} />
              <Route path="/admin/leagues/:leagueId" element={isSignedIn ? <LeagueAdminPage /> : <Navigate to="/" replace />} />
              <Route path="/leagues" element={<LeaguesPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>

            {/* Show profile completion modal for authenticated users without complete profiles */}
            {isSignedIn && !isProfileComplete && (
              <ProfileCompletionModal
                isOpen={showProfileModal}
                onComplete={handleProfileComplete}
                onCancel={handleProfileCancel}
                clerkUser={user}
              />
            )}
          </div>
        </Router>
    </ErrorBoundary>
  );
}

export default App;
