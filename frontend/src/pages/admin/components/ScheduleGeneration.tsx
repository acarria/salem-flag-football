import React, { useState } from 'react';
import { ScheduleGenerationRequest, ScheduleGenerationResponse, adminApi } from '../../../services';

interface ScheduleGenerationProps {
  leagueId: number;
  leagueName: string;
  onClose: () => void;
  onScheduleGenerated: (response: ScheduleGenerationResponse) => void;
}

export default function ScheduleGeneration({ leagueId, leagueName, onClose, onScheduleGenerated }: ScheduleGenerationProps) {
  const [formData, setFormData] = useState<ScheduleGenerationRequest>({
    start_date: undefined,
    game_duration: undefined,
    games_per_week: undefined,
    time_slots: ['18:00', '19:00', '20:00']
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ScheduleGenerationRequest) => ({
      ...prev,
      [name]: value === '' ? undefined : parseInt(value)
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ScheduleGenerationRequest) => ({
      ...prev,
      [name]: value === '' ? undefined : value
    }));
  };

  const handleTimeSlotsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const slots = e.target.value.split('\n').filter(slot => slot.trim() !== '');
    setFormData((prev: ScheduleGenerationRequest) => ({
      ...prev,
      time_slots: slots
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await adminApi.generateScheduleForLeague(leagueId, formData);
      setSuccess(`Successfully generated ${response.games_created} games over ${response.weeks_scheduled} weeks!`);
      onScheduleGenerated(response);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to generate schedule:', err);
      setError('Failed to generate schedule. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-pumpkin">Generate Schedule - {leagueName}</h3>
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
                Start Date (optional)
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date || ''}
                onChange={handleDateChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="Use league start date"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to use league start date
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Game Duration (minutes)
              </label>
              <input
                type="number"
                name="game_duration"
                value={formData.game_duration || ''}
                onChange={handleInputChange}
                min="30"
                max="120"
                step="15"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="Use league default"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Games Per Week
            </label>
            <input
              type="number"
              name="games_per_week"
              value={formData.games_per_week || ''}
              onChange={handleInputChange}
              min="1"
              max="5"
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="Use league default"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Game Time Slots (one per line, 24-hour format)
            </label>
            <textarea
              name="time_slots"
              value={formData.time_slots?.join('\n') || ''}
              onChange={handleTimeSlotsChange}
              rows={4}
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="18:00&#10;19:00&#10;20:00"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use 24-hour format (e.g., 18:00 for 6:00 PM)
            </p>
          </div>

          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-2">Schedule Generation Rules</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Schedule will be based on the league's tournament format</li>
              <li>• Round-robin: Each team plays every other team</li>
              <li>• Playoff bracket: Regular season + elimination tournament</li>
              <li>• Existing schedule will be cleared and recreated</li>
              <li>• Teams must exist before generating schedule</li>
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
              {isLoading ? 'Generating Schedule...' : 'Generate Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
