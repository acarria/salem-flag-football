import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import RegistrationModal from '../components/modals/RegistrationModal';
import BaseLayout from '../components/layout/BaseLayout';
import apiService, { Standing, Game } from '../services/api';

export default function PublicHomePage() {
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'standings' | 'schedule'>('standings');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [schedule, setSchedule] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useAuth();

  const handleRegisterClick = () => {
    if (isSignedIn) {
      setShowRegistrationModal(true);
    }
  };

  const handleRegistrationComplete = () => {
    console.log('Registration completed successfully');
  };

  // Fetch standings and schedule data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [standingsData, scheduleData] = await Promise.all([
          apiService.getStandings(),
          apiService.getSchedule()
        ]);
        
        setStandings(standingsData);
        setSchedule(scheduleData);
      } catch (err) {
        console.error('Failed to fetch league data:', err);
        setError('Failed to load league data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <BaseLayout 
      showHero={true}
      heroTitle="Salem Flag Football League"
      heroSubtitle="Join our community flag football league in historic Salem, Massachusetts. All skill levels welcome - come play, compete, and make new friends!"
    >
      {/* Hero Content */}
      <div className="max-w-6xl mx-auto px-4 text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
            <div className="text-3xl mb-2">📍</div>
            <h3 className="text-lg font-bold text-pumpkin mb-2">Salem Common</h3>
            <p className="text-gray-300">Games played at historic Salem Common</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="text-lg font-bold text-pumpkin mb-2">Tuesday Nights</h3>
            <p className="text-gray-300">6:00 PM start time, weather permitting</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="text-lg font-bold text-pumpkin mb-2">All Welcome</h3>
            <p className="text-gray-300">Open to players 18+ of all skill levels</p>
          </div>
        </div>
        <button
          onClick={handleRegisterClick}
          className="px-8 py-4 rounded bg-pumpkin text-black font-bold text-lg hover:bg-deeporange transition-colors shadow-lg"
        >
          {isSignedIn ? 'Register Now' : 'Join the League'}
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4">
        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a href="/rules" className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6 hover:bg-darkgunmetal transition-colors">
            <h3 className="text-lg font-bold text-pumpkin mb-2">📋 League Rules</h3>
            <p className="text-gray-300 text-sm">Learn about game rules, scoring, and league policies</p>
          </a>
          <a href="/info" className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6 hover:bg-darkgunmetal transition-colors">
            <h3 className="text-lg font-bold text-pumpkin mb-2">ℹ️ League Info</h3>
            <p className="text-gray-300 text-sm">Season details, locations, and important dates</p>
          </a>
          <a href="/contact" className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6 hover:bg-darkgunmetal transition-colors">
            <h3 className="text-lg font-bold text-pumpkin mb-2">📞 Contact Us</h3>
            <p className="text-gray-300 text-sm">Get in touch with league organizers</p>
          </a>
        </div>

        {/* Standings and Schedule */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-pumpkin">League Information</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-4 py-2 rounded font-bold transition-colors ${
                  activeTab === 'standings'
                    ? 'bg-pumpkin text-black'
                    : 'bg-black text-pumpkin border border-pumpkin'
                }`}
              >
                Standings
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-2 rounded font-bold transition-colors ${
                  activeTab === 'schedule'
                    ? 'bg-pumpkin text-black'
                    : 'bg-black text-pumpkin border border-pumpkin'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-pumpkin text-xl">Loading league data...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-400 text-xl mb-2">Error loading data</div>
              <div className="text-gray-400">{error}</div>
            </div>
          ) : (
            <>
              {activeTab === 'standings' && (
                <div className="space-y-4">
                  {standings.map((standing: any) => (
                    <div key={standing.rank} className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-pumpkin font-bold text-lg">#{standing.rank}</span>
                          <span className="font-semibold">{standing.team}</span>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <span>W: {standing.wins}</span>
                          <span>L: {standing.losses}</span>
                          <span>PF: {standing.pointsFor}</span>
                          <span>PA: {standing.pointsAgainst}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {schedule.map((game: any) => (
                    <div key={`${game.week}-${game.home}-${game.away}`} className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-pumpkin font-bold">Week {game.week}</span>
                        <span className="text-gray-400 text-sm">{game.date} at {game.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-center flex-1">
                          <div className="font-semibold">{game.home}</div>
                          <div className="text-sm text-gray-400">Home</div>
                        </div>
                        <div className="text-pumpkin font-bold text-xl mx-4">VS</div>
                        <div className="text-center flex-1">
                          <div className="font-semibold">{game.away}</div>
                          <div className="text-sm text-gray-400">Away</div>
                        </div>
                      </div>
                      <div className="text-center mt-2 text-sm text-gray-400">
                        📍 {game.location}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Registration CTA */}
        <div className="mt-8 bg-gradient-to-r from-pumpkin/30 to-deeporange/30 border-2 border-pumpkin rounded-xl p-6 text-center">
          <h2 className="text-2xl font-bold text-pumpkin mb-2">Ready to Join the League?</h2>
          <p className="text-gray-300 mb-4">
            Register as an individual player or form a team with friends. Don't miss out on the action!
          </p>
          <button
            onClick={handleRegisterClick}
            className="px-8 py-3 rounded bg-pumpkin text-black font-bold hover:bg-deeporange transition-colors"
          >
            {isSignedIn ? 'Register Now' : 'Sign In to Register'}
          </button>
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