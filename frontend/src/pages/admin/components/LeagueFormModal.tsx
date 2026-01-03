import React from 'react';
import { LeagueCreateRequest, TournamentFormat } from '../../../services';

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
  getTournamentFormatDescription
}: LeagueFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-accent rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-accent">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">League Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onInputChange}
              rows={3}
              className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Format *</label>
              <select
                name="format"
                value={formData.format}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="7v7">7v7</option>
                <option value="6v6">6v6</option>
                <option value="5v5">5v5</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Number of Weeks *</label>
              <input
                type="number"
                name="num_weeks"
                value={formData.num_weeks}
                onChange={onInputChange}
                min="1"
                required
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Duration (minutes)</label>
              <input
                type="number"
                name="game_duration"
                value={formData.game_duration}
                onChange={onInputChange}
                min="30"
                max="120"
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Tournament Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tournament Format *</label>
            <select
              name="tournament_format"
              value={formData.tournament_format}
              onChange={onInputChange}
              required
              className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss Tournament</option>
              <option value="playoff_bracket">Playoff Bracket</option>
              <option value="compass_draw">Compass Draw</option>
            </select>
            <p className="text-sm text-gray-400 mt-1">
              {getTournamentFormatDescription(formData.tournament_format as TournamentFormat)}
            </p>
          </div>

          {/* Team Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Teams</label>
              <input
                type="number"
                name="min_teams"
                value={formData.min_teams}
                onChange={onInputChange}
                min="2"
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Maximum Teams</label>
              <input
                type="number"
                name="max_teams"
                value={formData.max_teams || ''}
                onChange={onInputChange}
                min="1"
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Registration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Registration Deadline</label>
              <input
                type="date"
                name="registration_deadline"
                value={formData.registration_deadline}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Registration Fee (dollars)</label>
              <input
                type="number"
                name="registration_fee"
                value={formData.registration_fee || ''}
                onChange={onInputChange}
                min="0"
                step="0.01"
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="50.00"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save League'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border-2 border-accent text-accent font-bold rounded hover:bg-accent hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
