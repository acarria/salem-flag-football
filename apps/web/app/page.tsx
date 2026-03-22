'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import RegistrationModal from '@/components/modals/RegistrationModal';
import BaseLayout from '@/components/layout/BaseLayout';
import { apiService, League, PublicStanding, LeagueSchedule } from '@/services';
import { logger } from '@/utils/logger';

export default function HomePage() {
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'standings' | 'schedule'>('standings');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [standings, setStandings] = useState<PublicStanding[]>([]);
  const [leagueSchedule, setLeagueSchedule] = useState<LeagueSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  const handleRegisterClick = () => {
    if (isSignedIn) {
      setShowRegistrationModal(true);
    } else {
      openSignIn();
    }
  };

  const handleRegistrationComplete = () => {
    console.log('Registration completed successfully');
  };

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const data = await apiService.getPublicLeagues();
        const active = data.filter((l) => l.is_active);
        setLeagues(active);
        if (active.length > 0) {
          setSelectedLeagueId(active[0].id);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        logger.error('Failed to fetch leagues:', err);
        setIsLoading(false);
      }
    };
    fetchLeagues();
  }, []);

  useEffect(() => {
    if (!selectedLeagueId) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [standingsData, scheduleData] = await Promise.all([
          apiService.getLeagueStandings(selectedLeagueId),
          apiService.getLeaguePublicSchedule(selectedLeagueId),
        ]);

        setStandings(standingsData);
        setLeagueSchedule(scheduleData);
      } catch (err) {
        logger.error('Failed to fetch league data:', err);
        setError('Failed to load league data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedLeagueId]);

  return (
    <BaseLayout
      showHero={true}
      heroTitle="Salem Flag Football League"
      heroSubtitle="Join our community flag football league in historic Salem, Massachusetts. All skill levels welcome - come play, compete, and make new friends!"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 -mt-20 mb-24 animate-fade-in-up">
        <div className="flex justify-center mb-16">
          <button
            onClick={handleRegisterClick}
            className="bg-accent text-white text-sm font-medium py-2 px-6 rounded-md hover:bg-accent-dark transition-colors"
          >
            {isSignedIn ? 'Register Now' : 'Join the League'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-16">
          <div className="border-t border-white/10 pt-5 space-y-2 md:pr-8">
            <div className="text-xs font-mono text-[#6B6B6B] mb-3">01</div>
            <h3 className="text-base font-semibold text-white">Salem Common</h3>
            <p className="text-sm text-[#A0A0A0] leading-relaxed">Games played at historic Salem Common, a beautiful public park in the heart of Salem</p>
          </div>
          <div className="border-t border-white/10 pt-5 space-y-2 md:px-8">
            <div className="text-xs font-mono text-[#6B6B6B] mb-3">02</div>
            <h3 className="text-base font-semibold text-white">Tuesday Nights</h3>
            <p className="text-sm text-[#A0A0A0] leading-relaxed">6:00 PM start time, weather permitting. Regular season games every week</p>
          </div>
          <div className="border-t border-white/10 pt-5 space-y-2 md:pl-8">
            <div className="text-xs font-mono text-[#6B6B6B] mb-3">03</div>
            <h3 className="text-base font-semibold text-white">All Welcome</h3>
            <p className="text-sm text-[#A0A0A0] leading-relaxed">Open to players 18+ of all skill levels. Whether you're a beginner or experienced player</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="border-t border-b border-white/5 py-4 mb-16">
          <div className="flex flex-wrap gap-8">
            <a href="/rules" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              League Rules <span>→</span>
            </a>
            <a href="/info" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              League Info <span>→</span>
            </a>
            <a href="/contact" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              Contact Us <span>→</span>
            </a>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 mb-16">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <div className="section-label mb-1">LEAGUE INFORMATION</div>
              <h2 className="text-xl font-semibold text-white">
                {leagues.length === 1 ? leagues[0].name : 'Standings & Schedule'}
              </h2>
              {leagues.length > 1 && (
                <select
                  value={selectedLeagueId || ''}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  className="mt-2 bg-black/40 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
                >
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('standings')}
                className={`pb-0.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'standings'
                    ? 'border-white text-white'
                    : 'border-transparent text-[#6B6B6B] hover:text-white'
                }`}
              >
                Standings
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`pb-0.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'schedule'
                    ? 'border-white text-white'
                    : 'border-transparent text-[#6B6B6B] hover:text-white'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-[#6B6B6B]">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Loading league data...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-sm mb-1">Error loading data</div>
              <div className="text-[#6B6B6B] text-sm">{error}</div>
            </div>
          ) : !selectedLeagueId ? (
            <div className="text-center py-12 text-[#6B6B6B] text-sm">No active leagues found.</div>
          ) : (
            <>
              {activeTab === 'standings' && (
                <div>
                  {standings.length === 0 ? (
                    <div className="text-center py-8 text-[#6B6B6B] text-sm">
                      No standings yet — standings appear after games are completed.
                    </div>
                  ) : (
                    standings.map((s) => (
                      <div
                        key={s.team_id}
                        className="border-b border-white/5 py-3 flex items-center justify-between flex-wrap gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-[#6B6B6B] text-sm font-mono w-6">#{s.rank}</span>
                          <span className="font-medium text-white text-sm">{s.team_name}</span>
                        </div>
                        <div className="flex gap-6 text-xs text-[#A0A0A0]">
                          <span>W: <span className="text-white">{s.wins}</span></span>
                          <span>L: <span className="text-white">{s.losses}</span></span>
                          <span>PF: <span className="text-white">{s.points_for}</span></span>
                          <span>PA: <span className="text-white">{s.points_against}</span></span>
                          <span>Win%: <span className="text-white">{(s.win_percentage * 100).toFixed(0)}%</span></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  {!leagueSchedule || leagueSchedule.total_games === 0 ? (
                    <div className="text-center py-8 text-[#6B6B6B] text-sm">No schedule has been generated yet.</div>
                  ) : (
                    Object.keys(leagueSchedule.schedule_by_week)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((week) => (
                        <div key={week}>
                          <div className="section-label mb-3">WEEK {week}</div>
                          <div>
                            {leagueSchedule.schedule_by_week[week].map((game) => (
                              <div key={game.game_id} className="border-b border-white/5 py-3">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className="text-[#6B6B6B] text-xs">
                                    {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                                      weekday: 'short', month: 'short', day: 'numeric',
                                    })} at {game.time}
                                  </span>
                                  <span className="flex items-center gap-1.5 text-xs text-[#A0A0A0]">
                                    <span className={`status-dot ${
                                      game.status === 'completed' ? 'bg-green-400' :
                                      game.status === 'cancelled' ? 'bg-red-400' :
                                      'bg-[#6B6B6B]'
                                    }`}></span>
                                    {game.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-center flex-1">
                                    <div className="font-medium text-white text-sm">{game.team1_name}</div>
                                    {game.status === 'completed' && (
                                      <div className="text-lg font-semibold text-white mt-0.5">{game.team1_score ?? '–'}</div>
                                    )}
                                  </div>
                                  <div className="text-[#6B6B6B] text-xs font-mono mx-4">VS</div>
                                  <div className="text-center flex-1">
                                    <div className="font-medium text-white text-sm">{game.team2_name}</div>
                                    {game.status === 'completed' && (
                                      <div className="text-lg font-semibold text-white mt-0.5">{game.team2_score ?? '–'}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-16 mb-16 text-center">
          <div className="section-label mb-4">JOIN THE LEAGUE</div>
          <h2 className="text-3xl font-semibold text-white mb-3">Ready to Play?</h2>
          <p className="text-[#A0A0A0] mb-8 max-w-xl mx-auto">
            Register as an individual player or form a team with friends.
          </p>
          <button
            onClick={handleRegisterClick}
            className="bg-accent text-white text-sm font-medium py-2 px-6 rounded-md hover:bg-accent-dark transition-colors"
          >
            {isSignedIn ? 'Register Now' : 'Sign In to Register'}
          </button>
        </div>
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
