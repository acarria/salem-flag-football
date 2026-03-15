import React, { useState, useEffect } from 'react';
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
import { apiService, UserProfile } from './services';
import { AuthProvider } from './contexts/AuthContext';
import { invitationService, PendingInvitation } from './services/public/invitations';

function App() {
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  // Check if user has completed their profile and load pending invitations
  useEffect(() => {
    const checkProfile = async () => {
      if (isSignedIn && isLoaded && userId) {
        try {
          const profile = await apiService.getUserProfile(userId);
          if (profile) {
            setIsProfileComplete(true);
          } else {
            setShowProfileModal(true);
          }
        } catch (err) {
          console.error('Failed to check profile:', err);
          setShowProfileModal(true);
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
          registrationStatus: 'not_registered', // Just created account, not registered for league yet
          teamId: undefined,
          groupName: undefined,
          registrationDate: undefined,
          paymentStatus: undefined,
          waiverStatus: undefined
        };
        
        await apiService.updateUserProfile(userId, userProfile);
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
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-primary">
          {/* Admin dashboard is now handled within the page components */}

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
    </AuthProvider>
  );
}

export default App;
