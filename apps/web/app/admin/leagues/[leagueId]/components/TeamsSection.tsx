'use client';

import React from 'react';
import { Team } from '@/services';

interface TeamsSectionProps {
  teams: Team[];
  leagueId: string;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  onRefresh: (teams: Team[]) => void;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function TeamsSection({
  teams,
  leagueId,
  authenticatedRequest,
  onRefresh,
  setError,
  setSuccess,
}: TeamsSectionProps) {
  const handleGenerateTeams = async () => {
    try {
      await authenticatedRequest(`/admin/leagues/${leagueId}/generate-teams`, { method: 'POST', body: JSON.stringify({}) });
      setSuccess('Teams generated!');
      const data = await authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`);
      onRefresh(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate teams.');
    }
  };

  const handleRefresh = async () => {
    try {
      const data = await authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`);
      onRefresh(data);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-white">Teams <span className="text-[#6B6B6B] font-normal ml-1">({teams.length})</span></h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateTeams}
            className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-white/10"
          >
            Generate Teams
          </button>
          <button
            onClick={handleRefresh}
            className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
            title="Refresh"
          >
            &#8635;
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="admin-surface py-10 text-center text-sm text-[#6B6B6B]">No teams created yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => (
            <div key={team.id} className="bg-[#111111] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors">
              <div className="flex items-center gap-3">
                {team.color && (
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                )}
                <span className="text-sm font-medium text-white">{team.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
