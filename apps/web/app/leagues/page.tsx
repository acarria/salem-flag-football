'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import BaseLayout from '@/components/layout/BaseLayout';
import RegistrationModal from '@/components/modals/RegistrationModal';
import { League } from '@/services';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';

export default function LeaguesPage() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const router = useRouter();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  useEffect(() => {
    loadLeagues();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authenticatedRequest<League[]>('/league/public/leagues');
      setLeagues(data);
    } catch {
      setError('Failed to load leagues. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setShowRegistrationModal(true);
  };

  const handleRegistrationComplete = async () => {
    setSuccess('Registration submitted successfully!');
    setShowRegistrationModal(false);
    await loadLeagues();
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const activeLeagues = leagues.filter(l => l.is_active);
  const pastLeagues = leagues.filter(l => !l.is_active);

  const renderLeagueCard = (league: League) => {
    const occupied = league.player_cap != null && league.spots_remaining != null
      ? league.player_cap - league.spots_remaining
      : null;
    const fillPct = league.player_cap && occupied != null
      ? Math.min(100, Math.round((occupied / league.player_cap) * 100))
      : 0;
    const isRegistered = league.is_registered === true;
    const registrationStatusKnown = league.is_registered !== undefined;

    return (
      <div
        key={league.id}
        className="border border-white/10 rounded-lg p-4 hover:border-white/20 transition-all cursor-pointer group"
        onClick={() => router.push(`/leagues/${league.id}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-medium text-white group-hover:text-accent transition-colors truncate">
                {league.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-[#A0A0A0] flex-shrink-0">
                {league.format}
              </span>
            </div>
            <div className="text-xs text-[#6B6B6B]">
              Starts {formatDate(league.start_date)} · {league.num_weeks} weeks
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {league.is_active && league.is_registration_open && registrationStatusKnown && !isRegistered && (
              <button
                onClick={handleRegisterClick}
                className="bg-accent text-white text-xs font-medium py-1.5 px-3 rounded-md hover:bg-accent-dark transition-colors"
              >
                Register
              </button>
            )}
            {registrationStatusKnown && isRegistered && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                Registered
              </span>
            )}
            <span className={`flex items-center gap-1.5 text-xs ${
              !league.is_active ? 'text-[#6B6B6B]' :
              league.is_registration_open ? 'text-green-400' : 'text-[#A0A0A0]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                !league.is_active ? 'bg-[#6B6B6B]' :
                league.is_registration_open ? 'bg-green-400' : 'bg-[#A0A0A0]'
              }`} />
              {!league.is_active ? 'Completed' : league.is_registration_open ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {league.is_active && league.player_cap != null && occupied != null && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[#6B6B6B]">Spots</span>
              <span className="text-xs text-[#A0A0A0]">{occupied} / {league.player_cap}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="section-label mb-1">LEAGUES</div>
            <h1 className="text-xl font-semibold text-white">Leagues</h1>
          </div>
          <button
            onClick={loadLeagues}
            disabled={isLoading}
            className="text-sm text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-[#6B6B6B] hover:text-white text-sm ml-4">×</button>
          </div>
        )}
        {success && (
          <div className="mb-6 border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
            <span className="text-green-400 text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="text-[#6B6B6B] hover:text-white text-sm ml-4">×</button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 text-[#6B6B6B] text-sm">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Loading leagues...
            </div>
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-[#A0A0A0] mb-1">No leagues available</div>
            <div className="text-xs text-[#6B6B6B]">Check back later for upcoming leagues.</div>
          </div>
        ) : (
          <>
            {activeLeagues.length > 0 && (
              <section className="mb-10">
                <div className="section-label mb-4">ACTIVE LEAGUES</div>
                <div className="flex flex-col gap-3">
                  {activeLeagues.map(renderLeagueCard)}
                </div>
              </section>
            )}

            {pastLeagues.length > 0 && (
              <section>
                <div className="section-label mb-4 text-[#6B6B6B]">PAST LEAGUES</div>
                <div className="flex flex-col gap-3 opacity-70">
                  {pastLeagues.map(renderLeagueCard)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showRegistrationModal && (
        <RegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onRegistrationComplete={handleRegistrationComplete}
        />
      )}
    </BaseLayout>
  );
}
