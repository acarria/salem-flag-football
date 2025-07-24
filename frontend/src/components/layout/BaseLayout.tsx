import React, { useState } from 'react';
import { SignIn, useAuth, useClerk, UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../hooks';

interface BaseLayoutProps {
  children: React.ReactNode;
  showHero?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  heroBackground?: string;
}

export default function BaseLayout({ 
  children, 
  showHero = false,
  heroTitle = "Salem Flag Football League",
  heroSubtitle = "Community flag football in historic Salem, Massachusetts",
  heroBackground = '/salem_common_sunny.png'
}: BaseLayoutProps) {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { isAdmin } = useAdmin();
  
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handleLogout = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Fixed Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL + heroBackground})`
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-70"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-gunmetal bg-opacity-95 border-b-2 border-pumpkin p-4 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-full shadow-lg border-2 border-pumpkin bg-black">
                <img
                  src={process.env.PUBLIC_URL + '/salem_flag_football_logo.png'}
                  alt="Salem Flag Football League Logo"
                  className="w-8 h-8 object-contain rounded-full"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-pumpkin">Salem Flag Football League</h1>
                <p className="text-sm text-gray-400">Community flag football in historic Salem</p>
              </div>
            </div>

            {/* Center: Navigation Links (desktop only) */}
            <nav className="hidden md:flex flex-1 justify-center gap-8">
              <Link to="/" className="text-white hover:text-pumpkin transition-colors font-medium">Home</Link>
              <Link to="/rules" className="text-white hover:text-pumpkin transition-colors font-medium">Rules</Link>
              <Link to="/info" className="text-white hover:text-pumpkin transition-colors font-medium">League Info</Link>
              <Link to="/contact" className="text-white hover:text-pumpkin transition-colors font-medium">Contact</Link>
            </nav>

            {/* Right: User Actions */}
            <div className="flex items-center gap-4">
              {!isSignedIn && (
                <>
                  <button 
                    onClick={() => setShowSignInModal(true)} 
                    className="px-6 py-2 rounded bg-pumpkin text-black font-bold hover:bg-deeporange transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => setShowSignInModal(true)} 
                    className="px-4 py-2 rounded border-2 border-pumpkin text-pumpkin font-bold hover:bg-pumpkin hover:text-black transition-colors"
                  >
                    Register
                  </button>
                </>
              )}

              {isSignedIn && (
                <>
                  <Link to="/profile" className="text-white hover:text-pumpkin transition-colors font-medium">Profile</Link>
                  <button onClick={handleLogout} className="px-4 py-2 rounded border-2 border-pumpkin text-pumpkin font-bold hover:bg-pumpkin hover:text-black transition-colors">Logout</button>
                  
                  {/* Admin button - only show if user is admin */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  

                  
                  <div className="flex items-center ml-2">
                    <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10' } }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section (optional) */}
        {showHero && (
          <section className="min-h-screen flex items-center justify-center">
            <div className="max-w-6xl mx-auto px-4 text-center">
              <h2 className="text-4xl md:text-6xl font-bold text-pumpkin mb-6 drop-shadow-lg">
                🏈 {heroTitle}
              </h2>
              <p className="text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto drop-shadow-lg">
                {heroSubtitle}
              </p>
            </div>
          </section>
        )}

        {/* Main Content */}
        <main className={showHero ? '' : 'pt-8'}>
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-gunmetal bg-opacity-95 border-t-2 border-pumpkin mt-16 py-8">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-gray-400 mb-4">
              Salem Flag Football League - Community flag football in historic Salem, MA
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <Link to="/rules" className="text-pumpkin hover:text-deeporange">Rules</Link>
              <Link to="/info" className="text-pumpkin hover:text-deeporange">League Info</Link>
              <Link to="/contact" className="text-pumpkin hover:text-deeporange">Contact</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gunmetal border-2 border-pumpkin rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-pumpkin">Sign In</h3>
              <button
                onClick={() => setShowSignInModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SignIn 
              appearance={{ 
                variables: { 
                  colorPrimary: '#FF7518', 
                  colorBackground: '#18181b', 
                  colorText: '#fff' 
                } 
              }} 
              routing="hash" 
              signUpUrl="/sign-up"
              afterSignInUrl="/"
            />
          </div>
        </div>
      )}


    </div>
  );
} 