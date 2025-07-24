import React from 'react';
import { LeagueCreateRequest } from '../../../types';
import { TournamentFormat } from '../../../types/common';

interface LeagueFormModalProps {
  title: string;
  formData: Partial<LeagueCreateRequest>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  getTournamentFormatDescription: (format: TournamentFormat) => string;
}

export default function LeagueFormModal({
  title,
  formData,
  onInputChange,
  onSubmit,
  onCancel,
  isLoading,
  getTournamentFormatDescription,
}: LeagueFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                League Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date || ''}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={onInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
            />
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Game Format *
              </label>
              <select
                name="format"
                value={formData.format || '7v7'}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
              >
                <option value="7v7">7v7</option>
                <option value="5v5">5v5</option>
                <option value="4v4">4v4</option>
                <option value="3v3">3v3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Weeks *
              </label>
              <input
                type="number"
                name="num_weeks"
                value={formData.num_weeks || 8}
                onChange={onInputChange}
                min="1"
                max="52"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Game Duration (minutes) *
              </label>
              <input
                type="number"
                name="game_duration"
                value={formData.game_duration || 60}
                onChange={onInputChange}
                min="30"
                max="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Tournament Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tournament Format *
            </label>
            <select
              name="tournament_format"
              value={formData.tournament_format || 'round_robin'}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
            >
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss Tournament</option>
              <option value="playoff_bracket">Regular Season + Playoff Bracket</option>
              <option value="compass_draw">Compass Draw</option>
            </select>
            <p className="text-sm text-gray-600 mt-1">
              {getTournamentFormatDescription((formData.tournament_format as TournamentFormat) || 'round_robin')}
            </p>
          </div>

          {/* Tournament-specific settings */}
          {formData.tournament_format === 'swiss' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Rounds
                </label>
                <input
                  type="number"
                  name="swiss_rounds"
                  value={formData.swiss_rounds || ''}
                  onChange={onInputChange}
                  min="3"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pairing Method
                </label>
                <select
                  name="swiss_pairing_method"
                  value={formData.swiss_pairing_method || 'buchholz'}
                  onChange={onInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                >
                  <option value="buchholz">Buchholz</option>
                  <option value="sonneborn_berger">Sonneborn-Berger</option>
                </select>
              </div>
            </div>
          )}

          {formData.tournament_format === 'playoff_bracket' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Regular Season Weeks
                </label>
                <input
                  type="number"
                  name="regular_season_weeks"
                  value={formData.regular_season_weeks || ''}
                  onChange={onInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playoff Weeks
                </label>
                <input
                  type="number"
                  name="playoff_weeks"
                  value={formData.playoff_weeks || ''}
                  onChange={onInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teams in Playoffs
                </label>
                <input
                  type="number"
                  name="playoff_teams"
                  value={formData.playoff_teams || ''}
                  onChange={onInputChange}
                  min="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                />
              </div>
            </div>
          )}

          {formData.tournament_format === 'compass_draw' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Rounds
              </label>
              <input
                type="number"
                name="compass_draw_rounds"
                value={formData.compass_draw_rounds || ''}
                onChange={onInputChange}
                min="3"
                max="8"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
              />
            </div>
          )}

          {/* Team Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Teams *
              </label>
              <input
                type="number"
                name="min_teams"
                value={formData.min_teams || 4}
                onChange={onInputChange}
                min="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Teams
              </label>
              <input
                type="number"
                name="max_teams"
                value={formData.max_teams || ''}
                onChange={onInputChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Games Per Week *
              </label>
              <input
                type="number"
                name="games_per_week"
                value={formData.games_per_week || 1}
                onChange={onInputChange}
                min="1"
                max="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Registration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Deadline
              </label>
              <input
                type="date"
                name="registration_deadline"
                value={formData.registration_deadline || ''}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Fee (cents)
              </label>
              <input
                type="number"
                name="registration_fee"
                value={formData.registration_fee || ''}
                onChange={onInputChange}
                min="0"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
                placeholder="5000 = $50.00"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save League'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-500 text-white font-bold rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 