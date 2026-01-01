import React, { useState } from 'react';
import { TeamGenerationRequest, TeamGenerationResponse, adminApi } from '../../../services';

interface TeamGenerationProps {
  leagueId: number;
  leagueName: string;
  onClose: () => void;
  onTeamsGenerated: (response: TeamGenerationResponse) => void;
}

export default function TeamGeneration({ leagueId, leagueName, onClose, onTeamsGenerated }: TeamGenerationProps) {
  const [formData, setFormData] = useState<TeamGenerationRequest>({
    teams_count: undefined,
    max_players_per_team: undefined,
    min_players_per_team: undefined,
    team_names: [],
    team_colors: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: TeamGenerationRequest) => ({
      ...prev,
      [name]: value === '' ? undefined : parseInt(value)
    }));
  };

  const handleTeamNamesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const names = e.target.value.split('\n').filter(name => name.trim() !== '');
    setFormData((prev: TeamGenerationRequest) => ({
      ...prev,
      team_names: names
    }));
  };

  const handleTeamColorsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const colors = e.target.value.split('\n').filter(color => color.trim() !== '');
    setFormData((prev: TeamGenerationRequest) => ({
      ...prev,
      team_colors: colors
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await adminApi.generateTeams(leagueId, formData);
      setSuccess(`Successfully generated ${response.teams_created} teams with ${response.players_assigned} players assigned!`);
      onTeamsGenerated(response);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to generate teams:', err);
      setError('Failed to generate teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-pumpkin">Generate Teams - {leagueName}</h3>
          <button
            onClick={onClose}
            className="text-pumpkin hover:text-deeporange text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 text-red-200 rounded">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-white">×</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900 border border-green-500 text-green-200 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Number of Teams (optional)
              </label>
              <input
                type="number"
                name="teams_count"
                value={formData.teams_count || ''}
                onChange={handleInputChange}
                min="2"
                max="20"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="Auto-calculate"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to auto-calculate based on player count
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max Players Per Team
              </label>
              <input
                type="number"
                name="max_players_per_team"
                value={formData.max_players_per_team || ''}
                onChange={handleInputChange}
                min="1"
                max="20"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="No limit"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Min Players Per Team
            </label>
            <input
              type="number"
              name="min_players_per_team"
              value={formData.min_players_per_team || ''}
              onChange={handleInputChange}
              min="1"
              max="10"
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="No minimum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Custom Team Names (one per line, optional)
            </label>
            <textarea
              name="team_names"
              value={formData.team_names?.join('\n') || ''}
              onChange={handleTeamNamesChange}
              rows={4}
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="Red Dragons&#10;Blue Lightning&#10;Green Giants&#10;Yellow Thunder"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave empty to use default team names
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Custom Team Colors (one per line, hex codes, optional)
            </label>
            <textarea
              name="team_colors"
              value={formData.team_colors?.join('\n') || ''}
              onChange={handleTeamColorsChange}
              rows={3}
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="#FF4444&#10;#4444FF&#10;#44FF44&#10;#FFFF44"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave empty to use default team colors
            </p>
          </div>

          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-2">Team Generation Rules</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Groups will be kept together when possible</li>
              <li>• Teams will be balanced for equal player distribution</li>
              <li>• Existing teams will be cleared and recreated</li>
              <li>• Players must be registered to be assigned to teams</li>
            </ul>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-pumpkin text-pumpkin rounded hover:bg-pumpkin hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating Teams...' : 'Generate Teams'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
