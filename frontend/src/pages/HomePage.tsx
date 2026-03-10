import React, { useState, useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import RegistrationModal from '../components/modals/RegistrationModal';
import BaseLayout from '../components/layout/BaseLayout';
import { apiService, League, PublicStanding, LeagueSchedule } from '../services';

export default function PublicHomePage() {
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

  // Fetch active leagues on mount
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
        console.error('Failed to fetch leagues:', err);
        setIsLoading(false);
      }
    };
    fetchLeagues();
  }, []);

  // Fetch standings + schedule when selected league changes
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
        console.error('Failed to fetch league data:', err);
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
      {/* Hero CTA Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 -mt-20 mb-24 animate-fade-in-up">
        <div className="flex justify-center mb-16">
          <button
            onClick={handleRegisterClick}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-lg hover:shadow-2xl hover:shadow-accent/50 transition-all duration-300 hover:scale-105"
          >
            {isSignedIn ? 'Register Now' : 'Join the League'}
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="glass-effect rounded-2xl p-8 hover-lift border border-white/10 group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📍</div>
            <h3 className="text-xl font-bold text-white mb-3">Salem Common</h3>
            <p className="text-gray-400 leading-relaxed">Games played at historic Salem Common, a beautiful public park in the heart of Salem</p>
          </div>
          <div className="glass-effect rounded-2xl p-8 hover-lift border border-white/10 group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">⏰</div>
            <h3 className="text-xl font-bold text-white mb-3">Tuesday Nights</h3>
            <p className="text-gray-400 leading-relaxed">6:00 PM start time, weather permitting. Regular season games every week</p>
          </div>
          <div className="glass-effect rounded-2xl p-8 hover-lift border border-white/10 group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">👥</div>
            <h3 className="text-xl font-bold text-white mb-3">All Welcome</h3>
            <p className="text-gray-400 leading-relaxed">Open to players 18+ of all skill levels. Whether you're a beginner or experienced player</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <a 
            href="/rules" 
            className="glass-effect rounded-2xl p-6 hover-lift border border-white/10 group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300">📋</div>
              <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors">League Rules</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">Learn about game rules, scoring, and league policies</p>
          </a>
          <a 
            href="/info" 
            className="glass-effect rounded-2xl p-6 hover-lift border border-white/10 group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300">ℹ️</div>
              <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors">League Info</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">Season details, locations, and important dates</p>
          </a>
          <a 
            href="/contact" 
            className="glass-effect rounded-2xl p-6 hover-lift border border-white/10 group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300">📞</div>
              <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors">Contact Us</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">Get in touch with league organizers</p>
          </a>
        </div>

        {/* Standings and Schedule */}
        <div className="glass-effect rounded-2xl p-8 mb-16 border border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white">League Information</h2>
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
              {leagues.length === 1 && (
                <div className="text-gray-400 text-sm mt-1">{leagues[0].name}</div>
              )}
            </div>
            <div className="flex gap-2 bg-black/30 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'standings'
                    ? 'bg-gradient-to-r from-accent to-accent-dark text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Standings
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'schedule'
                    ? 'bg-gradient-to-r from-accent to-accent-dark text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-accent">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                <span className="text-lg font-medium">Loading league data...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-xl mb-2 font-semibold">Error loading data</div>
              <div className="text-gray-400">{error}</div>
            </div>
          ) : !selectedLeagueId ? (
            <div className="text-center py-12 text-gray-400">No active leagues found.</div>
          ) : (
            <>
              {activeTab === 'standings' && (
                <div className="space-y-3">
                  {standings.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No standings yet — standings appear after games are completed.
                    </div>
                  ) : (
                    standings.map((s) => (
                      <div
                        key={s.team_id}
                        className="bg-black/20 rounded-xl p-5 border border-white/5 hover:border-accent/30 hover:bg-black/30 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <span className="text-accent font-bold text-xl w-8">#{s.rank}</span>
                            <span className="font-semibold text-white text-lg">{s.team_name}</span>
                          </div>
                          <div className="flex gap-6 text-sm text-gray-300">
                            <span className="font-medium">W: <span className="text-white">{s.wins}</span></span>
                            <span className="font-medium">L: <span className="text-white">{s.losses}</span></span>
                            <span className="font-medium">PF: <span className="text-white">{s.points_for}</span></span>
                            <span className="font-medium">PA: <span className="text-white">{s.points_against}</span></span>
                            <span className="font-medium">Win%: <span className="text-white">{(s.win_percentage * 100).toFixed(0)}%</span></span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  {!leagueSchedule || leagueSchedule.total_games === 0 ? (
                    <div className="text-center py-8 text-gray-400">No schedule has been generated yet.</div>
                  ) : (
                    Object.keys(leagueSchedule.schedule_by_week)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((week) => (
                        <div key={week}>
                          <div className="text-accent font-bold text-lg mb-3">Week {week}</div>
                          <div className="space-y-3">
                            {leagueSchedule.schedule_by_week[week].map((game) => (
                              <div
                                key={game.game_id}
                                className="bg-black/20 rounded-xl p-5 border border-white/5 hover:border-accent/30 hover:bg-black/30 transition-all duration-200"
                              >
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                  <span className="text-gray-400 text-sm">
                                    {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                                      weekday: 'short', month: 'short', day: 'numeric',
                                    })} at {game.time}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    game.status === 'completed' ? 'bg-green-900 text-green-200' :
                                    game.status === 'cancelled' ? 'bg-red-900 text-red-300' :
                                    'bg-gray-700 text-gray-300'
                                  }`}>
                                    {game.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-center flex-1">
                                    <div className="font-semibold text-white text-lg">{game.team1_name}</div>
                                    {game.status === 'completed' && (
                                      <div className="text-2xl font-bold text-accent mt-1">{game.team1_score ?? '–'}</div>
                                    )}
                                  </div>
                                  <div className="text-accent font-bold text-xl mx-4">VS</div>
                                  <div className="text-center flex-1">
                                    <div className="font-semibold text-white text-lg">{game.team2_name}</div>
                                    {game.status === 'completed' && (
                                      <div className="text-2xl font-bold text-accent mt-1">{game.team2_score ?? '–'}</div>
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

        {/* Registration CTA */}
        <div className="mt-16 mb-16 glass-effect rounded-2xl p-12 text-center border border-accent/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-accent-dark/10"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Join the League?
            </h2>
            <p className="text-gray-300 mb-8 text-lg max-w-2xl mx-auto">
              Register as an individual player or form a team with friends. Don't miss out on the action!
            </p>
            <button
              onClick={handleRegisterClick}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-lg hover:shadow-2xl hover:shadow-accent/50 transition-all duration-300 hover:scale-105"
            >
              {isSignedIn ? 'Register Now' : 'Sign In to Register'}
            </button>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
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