'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { League, LeagueCreateRequest, TournamentFormat } from '@/services';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { inputCls, selectCls } from '@/utils/formStyles';

interface LeaguesSectionProps {
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function LeaguesSection({ authenticatedRequest, setError, setSuccess }: LeaguesSectionProps) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingLeague, setIsAddingLeague] = useState(false);
  const [leagueDraft, setLeagueDraft] = useState<Partial<LeagueCreateRequest>>({
    name: '', description: '', start_date: '', num_weeks: 8,
    format: '7v7', tournament_format: 'round_robin', game_duration: 60,
    games_per_week: 1, min_teams: 4,
  });
  const [leagueDraftError, setLeagueDraftError] = useState<string | null>(null);
  const [isSavingLeague, setIsSavingLeague] = useState(false);
  const [confirmDeleteLeague, setConfirmDeleteLeague] = useState<string | null>(null);

  useEffect(() => {
    loadLeagues();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeagues = async () => {
    setIsLoading(true);
    try {
      const data = await authenticatedRequest<League[]>('/admin/leagues');
      setLeagues(data);
    } catch { setError('Failed to load leagues.'); } finally { setIsLoading(false); }
  };

  const handleCreateLeague = async () => {
    if (!leagueDraft.name || !leagueDraft.start_date || !leagueDraft.num_weeks) {
      setLeagueDraftError('Name, start date, and number of weeks are required'); return;
    }
    setIsSavingLeague(true);
    setLeagueDraftError(null);
    try {
      await authenticatedRequest<League>('/admin/leagues', { method: 'POST', body: JSON.stringify(leagueDraft) });
      setSuccess('League created!');
      setIsAddingLeague(false);
      resetLeagueDraft();
      loadLeagues();
    } catch (e) {
      setLeagueDraftError((e as Error).message || 'Failed to create league.');
    } finally {
      setIsSavingLeague(false);
    }
  };

  const handleDeleteLeague = async (id: string) => {
    try {
      await authenticatedRequest(`/admin/leagues/${id}`, { method: 'DELETE' });
      setSuccess('League deleted!');
      loadLeagues();
    } catch { setError('Failed to delete league.'); }
    setConfirmDeleteLeague(null);
  };

  const resetLeagueDraft = () => setLeagueDraft({
    name: '', description: '', start_date: '', num_weeks: 8,
    format: '7v7', tournament_format: 'round_robin', game_duration: 60,
    games_per_week: 1, min_teams: 4,
  });

  return (
    <>
      <section id="leagues">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Leagues</h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">{leagues.length} total</p>
          </div>
        </div>

        <div className="admin-surface overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#6B6B6B]">Loading leagues&#8230;</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden md:table-cell">Format</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden md:table-cell">Status</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden sm:table-cell">Players</th>
                  <th className="w-44" />
                </tr>
              </thead>
              <tbody>
                {leagues.length === 0 && !isAddingLeague && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-[#6B6B6B]">No leagues yet.</td></tr>
                )}
                {leagues.map((league) => (
                  <tr key={league.id} className="admin-row">
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-white">{league.name}</div>
                      <div className="text-xs text-[#6B6B6B] mt-0.5 md:hidden">{league.format} &middot; {league.is_active ? 'Active' : 'Inactive'}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#A0A0A0] hidden md:table-cell">{league.format}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${league.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                        <span className="text-sm text-[#A0A0A0]">{league.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#A0A0A0] hidden sm:table-cell">{league.registered_players_count}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/admin/leagues/${league.id}`}
                          className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors whitespace-nowrap"
                        >
                          Manage &#8594;
                        </Link>
                        <button
                          onClick={() => setConfirmDeleteLeague(league.id)}
                          className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {isAddingLeague && (
                  <tr className="bg-white/[0.04] border-t border-white/5">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Name *</label>
                          <input
                            name="name"
                            value={leagueDraft.name || ''}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, name: e.target.value }))}
                            className={inputCls}
                            placeholder="League name"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Start Date *</label>
                          <input
                            type="date"
                            name="start_date"
                            value={leagueDraft.start_date || ''}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, start_date: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Format *</label>
                          <select
                            name="format"
                            value={leagueDraft.format || '7v7'}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, format: e.target.value }))}
                            className={selectCls}
                          >
                            <option value="7v7">7v7</option>
                            <option value="5v5">5v5</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Tournament Format *</label>
                          <select
                            name="tournament_format"
                            value={leagueDraft.tournament_format || 'round_robin'}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, tournament_format: e.target.value as TournamentFormat }))}
                            className={selectCls}
                          >
                            <option value="round_robin">Round Robin</option>
                            <option value="swiss">Swiss</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Num Weeks *</label>
                          <input
                            type="number"
                            name="num_weeks"
                            value={leagueDraft.num_weeks ?? 8}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, num_weeks: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Game Duration (min)</label>
                          <input
                            type="number"
                            name="game_duration"
                            value={leagueDraft.game_duration ?? 60}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, game_duration: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Min Teams</label>
                          <input
                            type="number"
                            name="min_teams"
                            value={leagueDraft.min_teams ?? 4}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, min_teams: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min={2}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Max Teams</label>
                          <input
                            type="number"
                            name="max_teams"
                            value={(leagueDraft as any).max_teams ?? ''}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, max_teams: e.target.value ? parseInt(e.target.value) : undefined } as any))}
                            className={inputCls}
                            min={2}
                            max={10}
                            placeholder="No limit"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Reg. Deadline</label>
                          <div className="px-3 py-2 bg-[#1E1E1E] border border-white/10 text-[#6B6B6B] text-sm rounded-md">
                            {(leagueDraft as any).start_date
                              ? (() => {
                                  const d = new Date((leagueDraft as any).start_date);
                                  d.setDate(d.getDate() - 8);
                                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                })()
                              : 'Set start date first'}
                            <span className="text-[#4A4A4A] ml-1">(auto)</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Reg. Fee ($)</label>
                          <input
                            type="number"
                            name="registration_fee"
                            value={(leagueDraft as any).registration_fee ?? ''}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, registration_fee: e.target.value ? parseFloat(e.target.value) : undefined } as any))}
                            className={inputCls}
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B6B6B] mb-1 block">Description</label>
                          <input
                            name="description"
                            value={leagueDraft.description || ''}
                            onChange={(e) => setLeagueDraft(prev => ({ ...prev, description: e.target.value }))}
                            className={inputCls}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                      {leagueDraftError && (
                        <p className="text-xs text-red-400 mb-2">{leagueDraftError}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateLeague}
                          disabled={isSavingLeague}
                          className="text-xs text-accent px-3 py-1.5 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          {isSavingLeague ? 'Saving\u2026' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setIsAddingLeague(false); resetLeagueDraft(); setLeagueDraftError(null); }}
                          className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {!isAddingLeague && !isLoading && (
            <div className="px-4 py-3 border-t border-white/5">
              <button
                onClick={() => { setIsAddingLeague(true); resetLeagueDraft(); setLeagueDraftError(null); }}
                className="text-xs text-[#6B6B6B] hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span>
                <span>Add league</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={!!confirmDeleteLeague}
        title="Delete League"
        message="Are you sure you want to delete this league? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDeleteLeague && handleDeleteLeague(confirmDeleteLeague)}
        onCancel={() => setConfirmDeleteLeague(null)}
      />
    </>
  );
}
