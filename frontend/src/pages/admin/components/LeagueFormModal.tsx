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

const inputCls =
  'w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
const labelCls = 'block text-xs font-medium text-[#A0A0A0] mb-1';

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onCancel} className="text-[#6B6B6B] hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
          {/* Basic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>League Name *</label>
              <input type="text" name="name" value={formData.name} onChange={onInputChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={onInputChange} required className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea name="description" value={formData.description} onChange={onInputChange} rows={2} className={inputCls + ' resize-none'} />
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Game Format *</label>
              <select name="format" value={formData.format} onChange={onInputChange} required className={inputCls + ' bg-[#1E1E1E]'}>
                <option value="7v7">7v7</option>
                <option value="6v6">6v6</option>
                <option value="5v5">5v5</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Number of Weeks *</label>
              <input type="number" name="num_weeks" value={formData.num_weeks} onChange={onInputChange} min="1" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Game Duration (min)</label>
              <input type="number" name="game_duration" value={formData.game_duration} onChange={onInputChange} min="30" max="120" className={inputCls} />
            </div>
          </div>

          {/* Tournament Format */}
          <div>
            <label className={labelCls}>Tournament Format *</label>
            <select name="tournament_format" value={formData.tournament_format} onChange={onInputChange} required className={inputCls + ' bg-[#1E1E1E]'}>
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss Tournament</option>
              <option value="playoff_bracket">Playoff Bracket</option>
              <option value="compass_draw">Compass Draw</option>
            </select>
            {formData.tournament_format && (
              <p className="text-xs text-[#6B6B6B] mt-1">
                {getTournamentFormatDescription(formData.tournament_format as TournamentFormat)}
              </p>
            )}
          </div>

          {/* Team Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Minimum Teams</label>
              <input type="number" name="min_teams" value={formData.min_teams} onChange={onInputChange} min="2" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Maximum Teams</label>
              <input type="number" name="max_teams" value={formData.max_teams || ''} onChange={onInputChange} min="1" className={inputCls} />
            </div>
          </div>

          {/* Registration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Registration Deadline</label>
              <input type="date" name="registration_deadline" value={formData.registration_deadline} onChange={onInputChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registration Fee ($)</label>
              <input type="number" name="registration_fee" value={formData.registration_fee || ''} onChange={onInputChange} min="0" step="0.01" className={inputCls} placeholder="50.00" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving…' : 'Save League'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 border border-white/15 text-white text-sm font-medium rounded-md hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
