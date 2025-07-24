import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import ProfileCompletionModal from './components/modals/ProfileCompletionModal';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import TestPage from './components/TestPage';
import apiService, { UserProfile } from './services/api';

function App() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Check if user has completed their profile
  useEffect(() => {
    const checkProfile = async () => {
      if (isSignedIn && isLoaded && userId) {
        try {
          const profile = await apiService.getUserProfile(userId);
          if (profile) {
            // User has a profile - they've completed the initial setup
            setIsProfileComplete(true);
          } else {
            // User doesn't have a profile - show the required profile completion modal
            setShowProfileModal(true);
          }
        } catch (err) {
          console.error('Failed to check profile:', err);
          // If we can't check the profile, assume they need to complete it
          setShowProfileModal(true);
        }
      }
    };

    checkProfile();
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
        // Still close modal but show error
        setIsProfileComplete(true);
        setShowProfileModal(false);
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-pumpkin text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-black">
        {/* Admin dashboard is now handled within the page components */}

        {/* Routes */}
                  <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/test" element={<TestPage />} />
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
  );
}

export default App;
