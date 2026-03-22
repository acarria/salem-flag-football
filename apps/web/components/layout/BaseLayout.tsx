'use client';

import React, { useState } from 'react';
import { SignIn, useAuth, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/hooks';
import { useMyTeam } from '@/hooks/useMyTeam';

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
  heroTitle = 'Salem Flag Football League',
  heroSubtitle = 'Community flag football in historic Salem, Massachusetts',
  heroBackground = '/images/salem_common_sunny.png',
}: BaseLayoutProps) {
  const { isSignedIn } = useAuth();
  const { isAdmin } = useAdmin();
  const { teamId } = useMyTeam();
  const pathname = usePathname();

  const [showSignInModal, setShowSignInModal] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/leagues', label: 'Leagues' },
    { href: '/rules', label: 'Rules' },
    { href: '/info', label: 'Info' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {showHero && (
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBackground})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/90 via-primary/85 to-primary/95" />
        </div>
      )}

      <div className="relative z-10">
        <header className="bg-black/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-2.5 group">
                <Image
                  src="/images/new_logo.png"
                  alt="Salem Flag Football"
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain"
                />
                <span className="hidden sm:block text-sm font-semibold text-white">
                  Salem Flag Football
                </span>
              </Link>

              <nav className="hidden md:flex flex-1 justify-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 text-sm transition-colors rounded-md ${
                      isActive(link.href)
                        ? 'text-white'
                        : 'text-[#A0A0A0] hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                {!isSignedIn && (
                  <>
                    <button
                      onClick={() => setShowSignInModal(true)}
                      className="px-3 py-1.5 text-sm text-[#A0A0A0] hover:text-white transition-colors hidden sm:block"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => setShowSignInModal(true)}
                      className="bg-accent text-white text-sm font-medium py-1.5 px-4 rounded-md hover:bg-accent-dark transition-colors"
                    >
                      Get Started
                    </button>
                  </>
                )}

                {isSignedIn && (
                  <>
                    {teamId && (
                      <Link
                        href={`/teams/${teamId}`}
                        className={`px-3 py-1.5 text-sm transition-colors rounded-md hidden sm:block ${
                          pathname.startsWith('/teams/')
                            ? 'text-white'
                            : 'text-[#A0A0A0] hover:text-white'
                        }`}
                      >
                        My Team
                      </Link>
                    )}
                    <Link
                      href="/profile"
                      className="px-3 py-1.5 text-sm text-[#A0A0A0] hover:text-white transition-colors hidden sm:block"
                    >
                      Profile
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="text-xs text-accent/70 hover:text-accent border border-accent/20 px-3 py-1 rounded-md transition-colors"
                      >
                        Admin
                      </Link>
                    )}

                    <div className="flex items-center ml-1">
                      <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {showHero && (
          <section className="min-h-[85vh] flex items-center justify-center pt-20 pb-32">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect border border-white/10 mb-8 animate-fade-in">
                <span className="text-accent" aria-hidden="true">🏈</span>
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

        <main className={showHero ? '' : 'pt-8'}>
          {children}
        </main>

        <footer className="border-t border-white/5 mt-24 py-12 bg-black/60">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2.5 mb-4">
                  <Image
                    src="/images/new_logo.png"
                    alt="Salem Flag Football"
                    width={24}
                    height={24}
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-sm font-semibold text-white">Salem Flag Football</span>
                </div>
                <p className="text-xs text-[#6B6B6B] max-w-md">
                  Community flag football in historic Salem, Massachusetts. Join us for competitive play, camaraderie, and fun.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-4">League</h3>
                <div className="flex flex-col gap-3">
                  <Link href="/leagues" className="text-xs text-[#6B6B6B] hover:text-white transition-colors">Leagues</Link>
                  <Link href="/rules" className="text-xs text-[#6B6B6B] hover:text-white transition-colors">Rules</Link>
                  <Link href="/info" className="text-xs text-[#6B6B6B] hover:text-white transition-colors">League Info</Link>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-4">Support</h3>
                <div className="flex flex-col gap-3">
                  <Link href="/contact" className="text-xs text-[#6B6B6B] hover:text-white transition-colors">Contact</Link>
                  <Link href="/profile" className="text-xs text-[#6B6B6B] hover:text-white transition-colors">Profile</Link>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-[#6B6B6B]">
                © {new Date().getFullYear()} Salem Flag Football League. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {showSignInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-md w-full animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Sign In</h3>
              <button
                onClick={() => setShowSignInModal(false)}
                aria-label="Close"
                className="text-[#6B6B6B] hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <span className="text-xl leading-none">×</span>
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
                  socialButtonsBlockButton: {
                    backgroundColor: '#ffffff',
                    borderColor: '#d1d5db',
                    color: '#111827',
                  },
                  socialButtonsBlockButtonText: { color: '#111827' },
                  socialButtonsIconButton: {
                    backgroundColor: '#ffffff',
                    borderColor: '#d1d5db',
                  },
                  dividerText: { color: '#9ca3af' },
                  dividerLine: { backgroundColor: '#374151' },
                  footerActionLink: { color: '#10B981' },
                },
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
