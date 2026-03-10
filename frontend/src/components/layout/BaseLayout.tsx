import React, { useState } from 'react';
import { SignIn, useAuth, useClerk, UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../hooks';
import salemCommonSunny from '../../assets/images/salem_common_sunny.png';
import salemFlagFootballLogo from '../../assets/images/new_logo.png';

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
  heroBackground = salemCommonSunny
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
      {/* Fixed Background Image - only show on homepage */}
      {showHero && (
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${heroBackground})`
          }}
        >
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/90 via-primary/85 to-primary/95"></div>
        </div>
      )}

      {/* Content Container */}
      <div className="relative z-10">
        {/* Header */}
        <header className="glass-effect sticky top-0 z-30 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-24">
              {/* Left: Logo and Title */}
              <Link to="/" className="flex items-center gap-4 group">
                <div className="w-20 h-20 flex items-center justify-center rounded-xl shadow-xl border-2 border-accent/50 bg-black/40 backdrop-blur-sm group-hover:border-accent group-hover:shadow-accent/30 transition-all duration-300">
                  <img
                    src={salemFlagFootballLogo}
                    alt="Salem Flag Football League Logo"
                    className="w-16 h-16 object-contain drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 
                    className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF0080] via-[#FF7F00] via-[#FFD700] via-[#10B981] to-[#00D9FF] group-hover:opacity-90 transition-all duration-300"
                    style={{ 
                      textShadow: '0 0 20px rgba(255, 0, 128, 0.3), 0 0 40px rgba(0, 217, 255, 0.2)',
                      backgroundSize: '200% auto',
                      animation: 'rainbow-shift 3s ease infinite',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    Salem Flag Football Community League
                  </h1>
                </div>
              </Link>

              {/* Center: Navigation Links (desktop only) */}
              <nav className="hidden md:flex flex-1 justify-center gap-2">
                <Link 
                  to="/" 
                  className="px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 text-[#FF0080] hover:text-[#FF40A0] hover:bg-[#FF0080]/10 hover:shadow-[0_0_15px_rgba(255,0,128,0.6)]"
                  style={{ textShadow: '0 0 10px rgba(255, 0, 128, 0.5), 0 0 20px rgba(255, 0, 128, 0.3)' }}
                >
                  Home
                </Link>
                <Link 
                  to="/leagues" 
                  className="px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 text-[#FF7F00] hover:text-[#FF9F40] hover:bg-[#FF7F00]/10 hover:shadow-[0_0_15px_rgba(255,127,0,0.6)]"
                  style={{ textShadow: '0 0 10px rgba(255, 127, 0, 0.5), 0 0 20px rgba(255, 127, 0, 0.3)' }}
                >
                  Leagues
                </Link>
                <Link 
                  to="/rules" 
                  className="px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 text-[#FFD700] hover:text-[#FFED4E] hover:bg-[#FFD700]/10 hover:shadow-[0_0_15px_rgba(255,215,0,0.6)]"
                  style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3)' }}
                >
                  Rules
                </Link>
                <Link 
                  to="/info" 
                  className="px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 text-[#10B981] hover:text-[#34D399] hover:bg-[#10B981]/10 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                  style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)' }}
                >
                  Info
                </Link>
                <Link 
                  to="/contact" 
                  className="px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 text-[#00D9FF] hover:text-[#40E5FF] hover:bg-[#00D9FF]/10 hover:shadow-[0_0_15px_rgba(0,217,255,0.6)]"
                  style={{ textShadow: '0 0 10px rgba(0, 217, 255, 0.5), 0 0 20px rgba(0, 217, 255, 0.3)' }}
                >
                  Contact
                </Link>
              </nav>

              {/* Right: User Actions */}
              <div className="flex items-center gap-3">
                {!isSignedIn && (
                  <>
                    <button 
                      onClick={() => setShowSignInModal(true)} 
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
                    >
                      Sign In
                    </button>
                    <button 
                      onClick={() => setShowSignInModal(true)} 
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dark text-white font-semibold text-sm hover:shadow-lg hover:shadow-accent/50 transition-all duration-300 hover:scale-105"
                    >
                      Get Started
                    </button>
                  </>
                )}

                {isSignedIn && (
                  <>
                    <Link 
                      to="/profile" 
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 hidden sm:block"
                    >
                      Profile
                    </Link>
                    
                    {/* Admin button - only show if user is admin */}
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent/20 to-accent-dark/20 border border-accent/30 text-accent font-semibold text-sm hover:bg-accent hover:text-white transition-all duration-300"
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
          </div>
        </header>

        {/* Hero Section (optional) */}
        {showHero && (
          <section className="min-h-[85vh] flex items-center justify-center pt-20 pb-32">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect border border-white/10 mb-8 animate-fade-in">
                <span className="text-accent">🏈</span>
                <span className="text-sm font-medium text-gray-300">Community Flag Football League</span>
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 text-balance leading-tight">
                <span className="text-white">{heroTitle.split(' ').slice(0, -1).join(' ')}</span>
                <br />
                <span className="gradient-text">{heroTitle.split(' ').slice(-1)[0]}</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto text-balance leading-relaxed">
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
        <footer className="glass-effect border-t border-white/10 mt-24 py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg border border-accent/30 bg-gradient-to-br from-accent/20 to-accent-dark/20">
                    <img
                      src={salemFlagFootballLogo}
                      alt="Salem Flag Football League Logo"
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                  <span className="text-lg font-bold text-white">Salem Flag Football</span>
                </div>
                <p className="text-gray-400 text-sm max-w-md">
                  Community flag football in historic Salem, Massachusetts. Join us for competitive play, camaraderie, and fun.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">League</h3>
                <div className="flex flex-col gap-3">
                  <Link to="/leagues" className="text-sm text-gray-400 hover:text-accent transition-colors">Leagues</Link>
                  <Link to="/rules" className="text-sm text-gray-400 hover:text-accent transition-colors">Rules</Link>
                  <Link to="/info" className="text-sm text-gray-400 hover:text-accent transition-colors">League Info</Link>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Support</h3>
                <div className="flex flex-col gap-3">
                  <Link to="/contact" className="text-sm text-gray-400 hover:text-accent transition-colors">Contact</Link>
                  <Link to="/profile" className="text-sm text-gray-400 hover:text-accent transition-colors">Profile</Link>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-white/10 text-center">
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} Salem Flag Football League. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-effect rounded-2xl p-8 max-w-md w-full border border-white/10 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Sign In</h3>
              <button
                onClick={() => setShowSignInModal(false)}
                className="text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
            <SignIn
              appearance={{
                variables: {
                  colorPrimary: '#10B981',
                  colorBackground: '#0A0A0A',
                  colorText: '#fff',
                  colorInputBackground: '#1A1A1A',
                  colorInputText: '#fff',
                },
                elements: {
                  // Social buttons need a light background so brand icons (Google, Apple, GitHub) are visible
                  socialButtonsBlockButton: {
                    backgroundColor: '#ffffff',
                    borderColor: '#d1d5db',
                    color: '#111827',
                  },
                  socialButtonsBlockButtonText: {
                    color: '#111827',
                  },
                  socialButtonsIconButton: {
                    backgroundColor: '#ffffff',
                    borderColor: '#d1d5db',
                  },
                  // Divider text
                  dividerText: {
                    color: '#9ca3af',
                  },
                  dividerLine: {
                    backgroundColor: '#374151',
                  },
                  // Footer links
                  footerActionLink: {
                    color: '#10B981',
                  },
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