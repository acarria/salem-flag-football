import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import { apiService, League } from '../services';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';

export default function LeaguesPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { request: authenticatedRequest } = useAuthenticatedApi();
  
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Load leagues on component mount
  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading leagues...');
      const leaguesData = await apiService.getPublicLeagues();
      console.log('Leagues loaded:', leaguesData);
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeagueSelect = (league: League) => {
    setSelectedLeague(league);
  };

  const handleRegisterForLeague = () => {
    if (!isSignedIn) {
      // Redirect to sign in or show sign in modal
      navigate('/');
      return;
    }
    
    if (!selectedLeague) {
      setError('Please select a league to register for');
      return;
    }

    setShowRegistrationModal(true);
  };

  const handleRegistrationComplete = () => {
    setSuccess('Registration submitted successfully!');
    setShowRegistrationModal(false);
    // Optionally reload leagues to update registration counts
    loadLeagues();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (dollars: number | null | undefined) => {
    if (!dollars) return 'Free';
    return `$${dollars.toFixed(2)}`;
  };

  const getRegistrationStatus = (league: League) => {
    if (!league.is_active) return { status: 'inactive', text: 'League Inactive', color: 'text-red-400' };
    if (league.registration_deadline && new Date(league.registration_deadline) < new Date()) {
      return { status: 'closed', text: 'Registration Closed', color: 'text-red-400' };
    }
    if (league.max_teams && league.registered_teams_count >= league.max_teams) {
      return { status: 'full', text: 'League Full', color: 'text-yellow-400' };
    }
    return { status: 'open', text: 'Registration Open', color: 'text-green-400' };
  };

  return (
    <BaseLayout>
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pumpkin mb-2">Available Leagues</h1>
          <p className="text-gray-300">Browse and register for flag football leagues</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-300">
            {success}
            <button 
              onClick={() => setSuccess(null)}
              className="float-right text-green-400 hover:text-green-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={loadLeagues}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            🔄 Refresh Leagues
          </button>
          {selectedLeague && (
            <button
              onClick={handleRegisterForLeague}
              disabled={!isSignedIn}
              className="px-6 py-3 bg-pumpkin text-black font-bold rounded-lg hover:bg-deeporange transition-colors disabled:opacity-50"
            >
              {isSignedIn ? 'Register for Selected League' : 'Sign In to Register'}
            </button>
          )}
        </div>

        {/* Leagues Grid */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-pumpkin text-xl">Loading leagues...</div>
          </div>
        ) : leagues.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-xl mb-4">No leagues available</div>
            <p className="text-gray-500">Check back later for upcoming leagues!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => {
              const registrationStatus = getRegistrationStatus(league);
              const isSelected = selectedLeague?.id === league.id;
              
              return (
                <div 
                  key={league.id} 
                  className={`bg-gunmetal bg-opacity-95 border-2 rounded-xl p-6 cursor-pointer transition-all hover:border-pumpkin ${
                    isSelected ? 'border-pumpkin' : 'border-gray-700'
                  }`}
                  onClick={() => handleLeagueSelect(league)}
                >
                  {/* League Header */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-pumpkin">{league.name}</h3>
                    <span className={`text-sm font-semibold ${registrationStatus.color}`}>
                      {registrationStatus.text}
                    </span>
                  </div>

                  {/* League Description */}
                  {league.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {league.description}
                    </p>
                  )}

                  {/* League Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Format:</span>
                      <span className="text-white">{league.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tournament:</span>
                      <span className="text-white">{league.tournament_format.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Start Date:</span>
                      <span className="text-white">{formatDate(league.start_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">{league.num_weeks} weeks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Registration Fee:</span>
                      <span className="text-white">{formatCurrency(league.registration_fee)}</span>
                    </div>
                    {league.registration_deadline && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Deadline:</span>
                        <span className="text-white">{formatDate(league.registration_deadline)}</span>
                      </div>
                    )}
                  </div>

                  {/* Registration Stats */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Teams:</span>
                      <span className="text-white">
                        {league.registered_teams_count} / {league.max_teams || '∞'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Players:</span>
                      <span className="text-white">{league.registered_players_count}</span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="mt-4 text-center">
                      <span className="text-pumpkin font-semibold">✓ Selected</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Selected League Details */}
        {selectedLeague && (
          <div className="mt-8 bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
            <h2 className="text-2xl font-bold text-pumpkin mb-4">League Details: {selectedLeague.name}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-bold text-pumpkin mb-3">League Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-400">Description:</span> {selectedLeague.description || 'No description available'}</div>
                  <div><span className="text-gray-400">Game Format:</span> {selectedLeague.format}</div>
                  <div><span className="text-gray-400">Tournament Format:</span> {selectedLeague.tournament_format.replace('_', ' ')}</div>
                  <div><span className="text-gray-400">Game Duration:</span> {selectedLeague.game_duration} minutes</div>
                  <div><span className="text-gray-400">Games Per Week:</span> {selectedLeague.games_per_week}</div>
                </div>
              </div>

              {/* Registration Information */}
              <div>
                <h3 className="text-lg font-bold text-pumpkin mb-3">Registration Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-400">Registration Fee:</span> {formatCurrency(selectedLeague.registration_fee)}</div>
                  <div><span className="text-gray-400">Minimum Teams:</span> {selectedLeague.min_teams}</div>
                  <div><span className="text-gray-400">Maximum Teams:</span> {selectedLeague.max_teams || 'No limit'}</div>
                  {selectedLeague.registration_deadline && (
                    <div><span className="text-gray-400">Registration Deadline:</span> {formatDate(selectedLeague.registration_deadline)}</div>
                  )}
                  <div><span className="text-gray-400">Current Teams:</span> {selectedLeague.registered_teams_count}</div>
                  <div><span className="text-gray-400">Current Players:</span> {selectedLeague.registered_players_count}</div>
                </div>
              </div>
            </div>

            {/* Registration Button */}
            <div className="mt-6 text-center">
              <button
                onClick={handleRegisterForLeague}
                disabled={!isSignedIn}
                className="px-8 py-3 bg-pumpkin text-black font-bold rounded-lg hover:bg-deeporange transition-colors disabled:opacity-50"
              >
                {isSignedIn ? 'Register for This League' : 'Sign In to Register'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showRegistrationModal && selectedLeague && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gunmetal border-2 border-pumpkin rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-pumpkin">Register for {selectedLeague.name}</h3>
              <button 
                onClick={() => setShowRegistrationModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                Registration form will be implemented here. This would include:
              </p>
              <ul className="text-gray-300 space-y-2 ml-4">
                <li>• Player information (name, email, phone)</li>
                <li>• Team preferences (join existing team or create new)</li>
                <li>• Payment processing for registration fee</li>
                <li>• Waiver agreement</li>
                <li>• Emergency contact information</li>
              </ul>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleRegistrationComplete}
                  className="px-6 py-3 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors"
                >
                  Submit Registration
                </button>
                <button
                  onClick={() => setShowRegistrationModal(false)}
                  className="px-6 py-3 border-2 border-pumpkin text-pumpkin font-bold rounded hover:bg-pumpkin hover:text-black transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
} 