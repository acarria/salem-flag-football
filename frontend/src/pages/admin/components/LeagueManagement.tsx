import React from 'react';
import { League, LeagueStats } from '../../../types';

interface LeagueManagementProps {
  leagues: League[];
  selectedLeague: League | null;
  leagueStats: LeagueStats | null;
  isLoading: boolean;
  onSelectLeague: (league: League) => void;
  onEditLeague: (league: League) => void;
  onDeleteLeague: (leagueId: number) => void;
  onCreateLeague: () => void;
}

export default function LeagueManagement({
  leagues,
  selectedLeague,
  leagueStats,
  isLoading,
  onSelectLeague,
  onEditLeague,
  onDeleteLeague,
  onCreateLeague,
}: LeagueManagementProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pumpkin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">League Management</h2>
        <button
          onClick={onCreateLeague}
          className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors"
        >
          Create New League
        </button>
      </div>

      {/* Leagues List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leagues.map((league) => (
          <div
            key={league.id}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedLeague?.id === league.id
                ? 'border-pumpkin bg-pumpkin/10'
                : 'border-gray-200 hover:border-pumpkin'
            }`}
            onClick={() => onSelectLeague(league)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg text-gray-900">{league.name}</h3>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  league.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {league.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{league.description}</p>
            
            <div className="text-sm text-gray-500 space-y-1">
              <div>Format: {league.format}</div>
              <div>Tournament: {league.tournament_format.replace('_', ' ')}</div>
              <div>Duration: {league.num_weeks} weeks</div>
              <div>Teams: {league.registered_teams_count || 0} / {league.max_teams || '∞'}</div>
              <div>Players: {league.registered_players_count || 0}</div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLeague(league);
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLeague(league.id);
                }}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* League Stats */}
      {selectedLeague && leagueStats && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">League Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-pumpkin">{leagueStats.total_teams}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pumpkin">{leagueStats.total_players}</div>
              <div className="text-sm text-gray-600">Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pumpkin">{leagueStats.days_until_start}</div>
              <div className="text-sm text-gray-600">Days Until Start</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pumpkin">{leagueStats.registration_status}</div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
        </div>
      )}

      {leagues.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No leagues found. Create your first league to get started!</p>
        </div>
      )}
    </div>
  );
} 