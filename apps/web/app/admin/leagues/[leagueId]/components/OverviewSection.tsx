'use client';

import React, { useState } from 'react';
import {
  League, LeagueCreateRequest, LeagueUpdateRequest, TournamentFormat,
} from '@/services';
import InlineEditableField from '@/components/common/InlineEditableField';

type GameFormat = '7v7' | '5v5';

interface OverviewSectionProps {
  league: League;
  onUpdate: (updatedLeague: League) => void;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function OverviewSection({
  league,
  onUpdate,
  authenticatedRequest,
  setError,
  setSuccess,
}: OverviewSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<LeagueCreateRequest>>(() => buildFormData(league));

  function buildFormData(l: League): Partial<LeagueCreateRequest> {
    return {
      name: l.name,
      description: l.description || '',
      start_date: l.start_date,
      num_weeks: l.num_weeks,
      format: l.format as GameFormat,
      tournament_format: l.tournament_format as TournamentFormat,
      game_duration: l.game_duration,
      games_per_week: l.games_per_week,
      min_teams: l.min_teams,
      max_teams: l.max_teams || undefined,
      registration_deadline: l.registration_deadline || '',
      registration_fee: typeof l.registration_fee === 'number' ? l.registration_fee : (l.registration_fee ? Number(l.registration_fee) : undefined),
      swiss_rounds: l.swiss_rounds || undefined,
    };
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await authenticatedRequest<League>(`/admin/leagues/${league.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData as LeagueUpdateRequest),
      });
      setSuccess('League updated!');
      setIsEditing(false);
      onUpdate(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update league.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(buildFormData(league));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-white">Overview</h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-white/10"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving\u2026' : 'Save changes'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        <InlineEditableField
          label="League Name"
          name="name"
          value={formData.name}
          isEditing={isEditing}
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Description"
          name="description"
          value={formData.description}
          isEditing={isEditing}
          type="textarea"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Start Date"
          name="start_date"
          value={formData.start_date}
          displayValue={league.start_date ? new Date(league.start_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '\u2014'}
          isEditing={isEditing}
          type="date"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Game Format"
          name="format"
          value={formData.format}
          isEditing={isEditing}
          type="select"
          options={[{ value: '7v7', label: '7v7' }, { value: '5v5', label: '5v5' }]}
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Tournament Format"
          name="tournament_format"
          value={formData.tournament_format}
          displayValue={league.tournament_format.replace(/_/g, ' ')}
          isEditing={isEditing}
          type="select"
          options={[
            { value: 'round_robin', label: 'Round Robin' },
            { value: 'swiss', label: 'Swiss' },
          ]}
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Weeks"
          name="num_weeks"
          value={formData.num_weeks}
          isEditing={isEditing}
          type="number"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Game Duration (min)"
          name="game_duration"
          value={formData.game_duration}
          isEditing={isEditing}
          type="number"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Games Per Week"
          name="games_per_week"
          value={formData.games_per_week}
          isEditing={isEditing}
          type="number"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Registration Deadline"
          name="registration_deadline"
          value={formData.registration_deadline}
          displayValue={league.registration_deadline ? new Date(league.registration_deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' (auto)' : '\u2014'}
          isEditing={false}
          type="date"
          onChange={handleInputChange}
        />
        <InlineEditableField
          label="Registration Fee"
          name="registration_fee"
          value={formData.registration_fee}
          displayValue={`$${typeof league.registration_fee === 'number' ? league.registration_fee.toFixed(2) : Number(league.registration_fee || 0).toFixed(2)}`}
          isEditing={isEditing}
          type="number"
          onChange={handleInputChange}
        />
        <div className="space-y-1">
          <div className="text-xs text-[#6B6B6B]">Registered Players</div>
          <div className="text-sm font-medium text-white">{league.registered_players_count}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-[#6B6B6B]">Teams</div>
          <div className="text-sm font-medium text-white">{league.registered_teams_count}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-[#6B6B6B]">Status</div>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${league.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
            <span className="text-sm font-medium text-white">{league.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
