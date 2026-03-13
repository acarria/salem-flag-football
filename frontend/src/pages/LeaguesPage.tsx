import React, { useState, useEffect } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import BaseLayout from '../components/layout/BaseLayout';
import RegistrationModal from '../components/modals/RegistrationModal';
import { apiService, League } from '../services';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';

export default function LeaguesPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registeredLeagues, setRegisteredLeagues] = useState<Set<string>>(new Set());
  const [unregisterConfirm, setUnregisterConfirm] = useState<string | null>(null);
  const [isUnregistering, setIsUnregistering] = useState(false);

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
    if (isSignedIn && user && leagues.length > 0) {
      checkRegistrationStatus();
    }
  }, [isSignedIn, user, leagues]);

  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaguesData = await apiService.getPublicLeagues();
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkRegistrationStatus = async () => {
    if (!user || !isSignedIn) return;

    try {
      const registrationChecks = await Promise.all(
        leagues.map(league =>
          apiService.checkLeagueRegistration(user.id, league.id)
            .then(result => ({ leagueId: league.id, isRegistered: result.isRegistered }))
            .catch(() => ({ leagueId: league.id, isRegistered: false }))
        )
      );

      const registeredSet = new Set<string>();
      registrationChecks.forEach(check => {
        if (check.isRegistered) registeredSet.add(check.leagueId);
      });

      setRegisteredLeagues(registeredSet);
    } catch (err) {
      console.error('Failed to check registration status:', err);
    }
  };

  const handleLeagueSelect = (league: League) => {
    setSelectedLeague(prev => prev?.id === league.id ? null : league);
  };

  const handleRegisterForLeague = () => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    if (!selectedLeague) {
      setError('Please select a league to register for');
      return;
    }
    setShowRegistrationModal(true);
  };

  const handleRegistrationComplete = async () => {
    setSuccess('Registration submitted successfully!');
    setShowRegistrationModal(false);
    await loadLeagues();
    if (selectedLeague && user) {
      try {
        const result = await apiService.checkLeagueRegistration(user.id, selectedLeague.id);
        if (result.isRegistered) {
          setRegisteredLeagues(prev => new Set([...Array.from(prev), selectedLeague.id]));
        }
      } catch (err) {
        console.error('Failed to check registration status:', err);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatCurrency = (dollars: number | null | undefined) => {
    if (!dollars) return 'Free';
    return `$${dollars.toFixed(2)}`;
  };

  const getRegistrationStatus = (league: League) => {
    if (!league.is_active) return { text: 'Inactive', dotColor: 'bg-red-400' };
    if (league.registration_deadline && new Date(league.registration_deadline) < new Date()) {
      return { text: 'Closed', dotColor: 'bg-red-400' };
    }
    if (league.max_teams && league.registered_teams_count >= league.max_teams) {
      return { text: 'Full', dotColor: 'bg-yellow-400' };
    }
    if (isSignedIn && registeredLeagues.has(league.id)) {
      return { text: 'Registered', dotColor: 'bg-blue-400' };
    }
    return { text: 'Open', dotColor: 'bg-green-400' };
  };

  const isLeagueRegistered = (league: League) => isSignedIn && registeredLeagues.has(league.id);

  const handleUnregister = async (leagueId: string) => {
    setIsUnregistering(true);
    setError(null);
    try {
      await authenticatedRequest(`/registration/leagues/${leagueId}`, { method: 'DELETE' });
      setRegisteredLeagues(prev => {
        const next = new Set(prev);
        next.delete(leagueId);
        return next;
      });
      setUnregisterConfirm(null);
      setSuccess('You have been unregistered from the league.');
      await loadLeagues();
    } catch (err: any) {
      const msg = err?.message || 'Failed to unregister. Please try again.';
      setError(msg);
      setUnregisterConfirm(null);
    } finally {
      setIsUnregistering(false);
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="section-label mb-1">LEAGUES</div>
            <h1 className="text-xl font-semibold text-white">Available Leagues</h1>
          </div>
          <button
            onClick={loadLeagues}
            disabled={isLoading}
            className="text-sm text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        {/* Status messages */}
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

        {/* League list */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 text-[#6B6B6B] text-sm">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              Loading leagues...
            </div>
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-[#A0A0A0] mb-1">No leagues available</div>
            <div className="text-xs text-[#6B6B6B]">Check back later for upcoming leagues.</div>
          </div>
        ) : (
          <div className="border-t border-white/5">
            {leagues.map((league) => {
              const status = getRegistrationStatus(league);
              const isSelected = selectedLeague?.id === league.id;

              return (
                <div key={league.id}>
                  {/* League row */}
                  <button
                    onClick={() => handleLeagueSelect(league)}
                    className="w-full border-b border-white/5 py-4 flex items-center justify-between text-left hover:bg-white/[0.025] transition-colors px-1"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{league.name}</div>
                        <div className="text-xs text-[#6B6B6B] mt-0.5">
                          {league.format} · {league.num_weeks} weeks · starts {formatDate(league.start_date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="flex items-center gap-1.5 text-xs text-[#A0A0A0]">
                        <span className={`status-dot ${status.dotColor}`}></span>
                        {status.text}
                      </span>
                      <span className="text-[#6B6B6B] text-xs">{isSelected ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isSelected && (
                    <div className="border-b border-white/5 bg-white/[0.02] px-1 py-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 mb-5">
                        {/* Left column */}
                        <div>
                          <div className="section-label mb-3">DETAILS</div>
                          {league.description && (
                            <div className="border-b border-white/5 py-2.5 flex justify-between items-start gap-4">
                              <span className="text-xs text-[#A0A0A0]">Description</span>
                              <span className="text-xs text-white text-right max-w-[60%]">{league.description}</span>
                            </div>
                          )}
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Game Format</span>
                            <span className="text-xs text-white">{league.format}</span>
                          </div>
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Tournament</span>
                            <span className="text-xs text-white capitalize">{league.tournament_format.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Game Duration</span>
                            <span className="text-xs text-white">{league.game_duration} min</span>
                          </div>
                          <div className="py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Games / Week</span>
                            <span className="text-xs text-white">{league.games_per_week}</span>
                          </div>
                        </div>

                        {/* Right column */}
                        <div>
                          <div className="section-label mb-3">REGISTRATION</div>
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Fee</span>
                            <span className="text-xs text-white">{formatCurrency(league.registration_fee)}</span>
                          </div>
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Teams</span>
                            <span className="text-xs text-white">
                              {league.registered_teams_count} / {league.max_teams || '∞'}
                            </span>
                          </div>
                          <div className="border-b border-white/5 py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Players</span>
                            <span className="text-xs text-white">{league.registered_players_count}</span>
                          </div>
                          {league.registration_deadline && (
                            <div className="border-b border-white/5 py-2.5 flex justify-between">
                              <span className="text-xs text-[#A0A0A0]">Deadline</span>
                              <span className="text-xs text-white">{formatDate(league.registration_deadline)}</span>
                            </div>
                          )}
                          <div className="py-2.5 flex justify-between">
                            <span className="text-xs text-[#A0A0A0]">Min Teams</span>
                            <span className="text-xs text-white">{league.min_teams}</span>
                          </div>
                        </div>
                      </div>

                      {/* Register action */}
                      <div className="flex items-center gap-4">
                        {isLeagueRegistered(league) ? (
                          unregisterConfirm === league.id ? (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#A0A0A0]">Are you sure? This cannot be undone.</span>
                              <button
                                onClick={() => handleUnregister(league.id)}
                                disabled={isUnregistering}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                              >
                                {isUnregistering ? 'Removing…' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setUnregisterConfirm(null)}
                                disabled={isUnregistering}
                                className="text-xs text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-40"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                                <span className="status-dot bg-blue-400"></span>
                                You are registered for this league
                              </div>
                              <button
                                onClick={() => setUnregisterConfirm(league.id)}
                                className="text-xs text-[#6B6B6B] hover:text-red-400 transition-colors"
                              >
                                Unregister
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={handleRegisterForLeague}
                            className="bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors"
                          >
                            {isSignedIn ? 'Register for This League' : 'Sign In to Register'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showRegistrationModal && selectedLeague && (
        <RegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onRegistrationComplete={handleRegistrationComplete}
        />
      )}
    </BaseLayout>
  );
}
