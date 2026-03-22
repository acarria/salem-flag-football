'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';
import BaseLayout from '@/components/layout/BaseLayout';
import RegistrationModal from '@/components/modals/RegistrationModal';
import { leagueApi, League, PublicStanding, LeagueSchedule, MyTeamResponse } from '@/services';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';

interface RegistrationInfo {
  id: string;
  league_id: string;
  registration_status: string;
  team_id: string | null;
  group_id: string | null;
  group_name: string | null;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<PublicStanding[]>([]);
  const [schedule, setSchedule] = useState<LeagueSchedule | null>(null);
  const [myRegistration, setMyRegistration] = useState<RegistrationInfo | null>(null);
  const [myTeam, setMyTeam] = useState<MyTeamResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [unregisterConfirm, setUnregisterConfirm] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const [unregisterError, setUnregisterError] = useState<string | null>(null);

  const loadPublicData = useCallback(async () => {
    if (!leagueId) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [leagueData, standingsData, scheduleData] = await Promise.all([
        authenticatedRequest<League>(`/league/${leagueId}`),
        leagueApi.getLeagueStandings(leagueId).catch(() => [] as PublicStanding[]),
        leagueApi.getLeaguePublicSchedule(leagueId).catch(() => null as LeagueSchedule | null),
      ]);
      setLeague(leagueData);
      setStandings(standingsData);
      setSchedule(scheduleData);
      if (scheduleData?.schedule_by_week) {
        setExpandedWeeks(new Set(Object.keys(scheduleData.schedule_by_week).map(Number)));
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError('Failed to load league. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, authenticatedRequest]);

  const loadRegistrationData = useCallback(async () => {
    if (!isSignedIn || !user || !leagueId) return;
    try {
      const registrations = await authenticatedRequest<RegistrationInfo[]>(
        `/registration/player/${user.id}/leagues`
      );
      const myReg = registrations.find(r => r.league_id === leagueId) ?? null;
      setMyRegistration(myReg);
      if (myReg?.team_id) {
        try {
          const teamData = await authenticatedRequest<MyTeamResponse>(
            `/registration/leagues/${leagueId}/my-team`
          );
          setMyTeam(teamData);
        } catch {
          setMyTeam(null);
        }
      } else {
        setMyTeam(null);
      }
    } catch {
      // Non-fatal
    }
  }, [isSignedIn, user, leagueId, authenticatedRequest]);

  useEffect(() => { loadPublicData(); }, [loadPublicData]);
  useEffect(() => { loadRegistrationData(); }, [loadRegistrationData]);

  const handleRegistrationComplete = async () => {
    setShowRegistrationModal(false);
    await Promise.all([loadPublicData(), loadRegistrationData()]);
  };

  const handleUnregister = async () => {
    if (!leagueId) return;
    setIsUnregistering(true);
    setUnregisterError(null);
    try {
      await authenticatedRequest(`/registration/leagues/${leagueId}`, { method: 'DELETE' });
      setMyRegistration(null);
      setMyTeam(null);
      setUnregisterConfirm(false);
      await loadPublicData();
    } catch (err: any) {
      setUnregisterError(err?.message || 'Failed to unregister. Please try again.');
      setUnregisterConfirm(false);
    } finally {
      setIsUnregistering(false);
    }
  };

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [h, m] = timeString.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const formatCurrency = (dollars: number | null | undefined) => {
    if (!dollars) return 'Free';
    return `$${dollars.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <BaseLayout>
        <div className="max-w-3xl mx-auto px-6 py-16 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-[#6B6B6B] text-sm">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Loading league...
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (notFound || !league) {
    return (
      <BaseLayout>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="text-sm text-[#A0A0A0] mb-2">League not found</div>
          <Link href="/leagues" className="text-xs text-accent hover:underline">← Back to Leagues</Link>
        </div>
      </BaseLayout>
    );
  }

  const occupied = league.player_cap != null && league.spots_remaining != null
    ? league.player_cap - league.spots_remaining
    : null;
  const fillPct = league.player_cap && occupied != null
    ? Math.min(100, Math.round((occupied / league.player_cap) * 100))
    : 0;

  const isRegistered = myRegistration != null || league.is_registered === true;
  const hasTeam = myRegistration?.team_id != null;
  const showRegistrationSection = league.is_active && (league.is_registration_open || isRegistered);
  const weeks = schedule?.schedule_by_week
    ? Object.keys(schedule.schedule_by_week).map(Number).sort((a, b) => a - b)
    : [];

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/leagues" className="inline-flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-white transition-colors mb-6">
          ← Back to Leagues
        </Link>

        <div className="mb-8">
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-bold text-white">{league.name}</h1>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-[#A0A0A0] self-center">
              {league.format}
            </span>
            {!league.is_active && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#6B6B6B]/20 text-[#6B6B6B] self-center border border-[#6B6B6B]/20">
                Completed Season
              </span>
            )}
          </div>
          {league.description && (
            <p className="text-sm text-[#A0A0A0] mb-4">{league.description}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="section-label mb-0.5">START</div>
              <div className="text-sm text-white">{formatDate(league.start_date)}</div>
            </div>
            {league.end_date && (
              <div>
                <div className="section-label mb-0.5">END</div>
                <div className="text-sm text-white">{formatDate(league.end_date)}</div>
              </div>
            )}
            <div>
              <div className="section-label mb-0.5">FORMAT</div>
              <div className="text-sm text-white capitalize">{league.tournament_format.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="section-label mb-0.5">FEE</div>
              <div className="text-sm text-white">{formatCurrency(league.registration_fee)}</div>
            </div>
            <div>
              <div className="section-label mb-0.5">GAME LENGTH</div>
              <div className="text-sm text-white">{league.game_duration} min</div>
            </div>
            <div>
              <div className="section-label mb-0.5">GAMES/WEEK</div>
              <div className="text-sm text-white">{league.games_per_week}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-[#6B6B6B] hover:text-white text-sm ml-4">×</button>
          </div>
        )}

        {isSignedIn && (
          <div className="border border-white/10 rounded-lg p-4 mb-6 bg-white/[0.02]">
            <div className="section-label mb-2">YOUR STATUS</div>
            {!isRegistered ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[#A0A0A0]">You haven't registered yet</span>
                {league.is_active && league.is_registration_open && (
                  <button
                    onClick={() => setShowRegistrationModal(true)}
                    className="bg-accent text-white text-xs font-medium py-1.5 px-3 rounded-md hover:bg-accent-dark transition-colors flex-shrink-0"
                  >
                    Register Now
                  </button>
                )}
              </div>
            ) : hasTeam ? (
              <div className="flex items-center gap-2 text-sm text-white">
                <span className="status-dot bg-blue-400" />
                Registered · Team: <span className="font-medium">{myTeam?.team_name ?? myRegistration?.team_id}</span>
              </div>
            ) : myRegistration?.group_id ? (
              <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                <span className="status-dot bg-green-400" />
                Registered · Group: {myRegistration?.group_name ?? 'your group'} · Team assignment pending
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                <span className="status-dot bg-green-400" />
                Registered · Team assignment pending
              </div>
            )}
          </div>
        )}

        {showRegistrationSection && (
          <div className="border border-white/10 rounded-lg p-4 mb-6">
            <div className="section-label mb-3">REGISTRATION</div>

            {league.player_cap != null && occupied != null && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-[#A0A0A0]">Spots filled</span>
                  <span className="text-xs text-white">{occupied} of {league.player_cap}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>
            )}

            {league.registration_deadline && (
              <div className="text-xs text-[#A0A0A0] mb-4">
                Registration closes {formatDate(league.registration_deadline)}
              </div>
            )}

            {!isRegistered && league.is_registration_open && (
              <button
                onClick={() => setShowRegistrationModal(true)}
                className="bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors"
              >
                Register Now
              </button>
            )}

            {isRegistered && !hasTeam && (
              <div>
                {unregisterConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#A0A0A0]">Are you sure? This cannot be undone.</span>
                    <button
                      onClick={handleUnregister}
                      disabled={isUnregistering}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                      {isUnregistering ? 'Removing…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setUnregisterConfirm(false)}
                      disabled={isUnregistering}
                      className="text-xs text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUnregisterConfirm(true)}
                    className="text-xs text-[#6B6B6B] hover:text-red-400 transition-colors"
                  >
                    Unregister
                  </button>
                )}
                {unregisterError && (
                  <div className="text-xs text-red-400 mt-2">{unregisterError}</div>
                )}
              </div>
            )}

            {isRegistered && hasTeam && (
              <p className="text-xs text-[#6B6B6B]">
                Teams have been assigned; contact admin to withdraw.
              </p>
            )}
          </div>
        )}

        <div className="mb-6">
          <div className="section-label mb-3">STANDINGS</div>
          {standings.length === 0 ? (
            <div className="text-xs text-[#6B6B6B] py-4">
              Standings will appear once teams are formed.
            </div>
          ) : (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="text-left py-2 px-3 text-[#6B6B6B] font-medium w-8">#</th>
                    <th className="text-left py-2 px-3 text-[#6B6B6B] font-medium">Team</th>
                    <th className="text-center py-2 px-3 text-[#6B6B6B] font-medium">W</th>
                    <th className="text-center py-2 px-3 text-[#6B6B6B] font-medium">L</th>
                    <th className="text-center py-2 px-3 text-[#6B6B6B] font-medium hidden sm:table-cell">PF</th>
                    <th className="text-center py-2 px-3 text-[#6B6B6B] font-medium hidden sm:table-cell">PA</th>
                    <th className="text-center py-2 px-3 text-[#6B6B6B] font-medium">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(row => {
                    const isMyTeamRow = myTeam?.team_id === row.team_id;
                    return (
                      <tr
                        key={row.team_id}
                        className={`border-b border-white/5 last:border-0 ${
                          isMyTeamRow ? 'bg-accent/10' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-2 px-3 text-[#6B6B6B]">{row.rank}</td>
                        <td className="py-2 px-3 text-white font-medium">
                          {row.team_name}
                          {isMyTeamRow && <span className="text-accent ml-1.5 text-xs">(you)</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-white">{row.wins}</td>
                        <td className="py-2 px-3 text-center text-white">{row.losses}</td>
                        <td className="py-2 px-3 text-center text-[#A0A0A0] hidden sm:table-cell">{row.points_for}</td>
                        <td className="py-2 px-3 text-center text-[#A0A0A0] hidden sm:table-cell">{row.points_against}</td>
                        <td className="py-2 px-3 text-center text-[#A0A0A0]">
                          {(row.win_percentage * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="section-label mb-3">SCHEDULE</div>
          {weeks.length === 0 ? (
            <div className="text-xs text-[#6B6B6B] py-4">
              Schedule will appear once the season is set up.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {weeks.map(week => {
                const games = schedule!.schedule_by_week[week];
                const isExpanded = expandedWeeks.has(week);
                return (
                  <div key={week} className="border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleWeek(week)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-[#A0A0A0]">Week {week}</span>
                      <span className="text-[#6B6B6B] text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div>
                        {games.map(game => {
                          const isMyGame = myTeam && (
                            game.team1_id === myTeam.team_id || game.team2_id === myTeam.team_id
                          );
                          const isCompleted = game.status === 'completed';
                          return (
                            <div
                              key={game.game_id}
                              className={`flex items-center gap-3 px-4 py-2.5 border-t border-white/5 text-xs ${
                                isMyGame ? 'bg-accent/5' : ''
                              }`}
                            >
                              <span className="text-[#6B6B6B] w-20 flex-shrink-0">
                                {formatDate(game.date)}
                              </span>
                              <span className="text-[#6B6B6B] w-14 flex-shrink-0">
                                {formatTime(game.time)}
                              </span>
                              <span className="flex-1 text-white min-w-0">
                                {isCompleted ? (
                                  <>
                                    <span className={myTeam?.team_id === game.team1_id ? 'font-medium' : ''}>
                                      {game.team1_name}
                                    </span>
                                    <span className="text-[#A0A0A0] mx-2 font-mono">
                                      {game.team1_score ?? 0} – {game.team2_score ?? 0}
                                    </span>
                                    <span className={myTeam?.team_id === game.team2_id ? 'font-medium' : ''}>
                                      {game.team2_name}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className={myTeam?.team_id === game.team1_id ? 'font-medium' : ''}>
                                      {game.team1_name}
                                    </span>
                                    <span className="text-[#6B6B6B] mx-2">vs</span>
                                    <span className={myTeam?.team_id === game.team2_id ? 'font-medium' : ''}>
                                      {game.team2_name}
                                    </span>
                                  </>
                                )}
                              </span>
                              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${
                                game.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                game.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                'bg-white/10 text-[#6B6B6B]'
                              }`}>
                                {game.status === 'completed' ? 'Final' :
                                 game.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isSignedIn && myTeam && (
          <div className="border border-white/10 rounded-lg p-4">
            <div className="section-label mb-3">YOUR TEAM</div>
            <div className="flex items-center gap-2 mb-4">
              {myTeam.team_color && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: myTeam.team_color }}
                />
              )}
              <span className="text-base font-semibold text-white">{myTeam.team_name}</span>
            </div>
            <div className="flex flex-col gap-2">
              {myTeam.members.map((member, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={member.is_you ? 'text-white font-medium' : 'text-[#A0A0A0]'}>
                    {member.first_name} {member.last_name}
                  </span>
                  {member.is_you && (
                    <span className="text-xs text-accent">(you)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
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
