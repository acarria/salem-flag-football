'use client';

import React, { useState } from 'react';
import { LeagueSchedule, ScheduledGame, GameUpdateRequest } from '@/services';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const inputCls =
  'w-full px-2.5 py-1.5 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors';

interface ScheduleSectionProps {
  schedule: LeagueSchedule | null;
  leagueId: string;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  onRefresh: (schedule: LeagueSchedule | null) => void;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function ScheduleSection({
  schedule,
  leagueId,
  authenticatedRequest,
  onRefresh,
  setError,
  setSuccess,
}: ScheduleSectionProps) {
  const [confirmCancelGame, setConfirmCancelGame] = useState<string | null>(null);

  const handleUpdateGame = async (gameId: string, data: GameUpdateRequest) => {
    try {
      await authenticatedRequest(`/admin/leagues/${leagueId}/games/${gameId}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
      setSuccess('Game updated!');
      const scheduleData = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
      onRefresh(scheduleData);
    } catch (err: any) {
      setError(err.message || 'Failed to update game.');
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      await authenticatedRequest(`/admin/leagues/${leagueId}/generate-schedule`, { method: 'POST', body: JSON.stringify({}) });
      setSuccess('Schedule generated!');
      const data = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
      onRefresh(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate schedule.');
    }
  };

  const handleRefresh = async () => {
    try {
      const data = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
      onRefresh(data);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-white">Schedule</h2>
          {schedule && schedule.total_games > 0 && (
            <p className="text-xs text-[#6B6B6B] mt-0.5">{schedule.total_games} games</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateSchedule}
            className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-white/10"
          >
            Generate Schedule
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

      {!schedule || schedule.total_games === 0 ? (
        <div className="admin-surface py-10 text-center text-sm text-[#6B6B6B]">No schedule generated yet.</div>
      ) : (
        <ScheduleContent
          schedule={schedule}
          onUpdateGame={handleUpdateGame}
          onCancelGame={(gameId) => setConfirmCancelGame(gameId)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmCancelGame}
        title="Cancel Game"
        message="Are you sure you want to cancel this game?"
        confirmLabel="Cancel Game"
        variant="warning"
        onConfirm={async () => {
          if (confirmCancelGame) {
            await handleUpdateGame(confirmCancelGame, { status: 'cancelled' });
          }
          setConfirmCancelGame(null);
        }}
        onCancel={() => setConfirmCancelGame(null)}
      />
    </div>
  );
}

function ScheduleContent({
  schedule,
  onUpdateGame,
  onCancelGame,
}: {
  schedule: LeagueSchedule;
  onUpdateGame: (gameId: string, data: GameUpdateRequest) => Promise<void>;
  onCancelGame: (gameId: string) => void;
}) {
  const [scoringGameId, setScoringGameId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<{ team1: string; team2: string }>({ team1: '', team2: '' });
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editInputs, setEditInputs] = useState<{ game_date: string; game_time: string }>({ game_date: '', game_time: '' });
  const [saving, setSaving] = useState(false);

  const startScoring = (game: ScheduledGame) => {
    setScoringGameId(game.game_id);
    setScoreInputs({
      team1: game.team1_score != null ? String(game.team1_score) : '',
      team2: game.team2_score != null ? String(game.team2_score) : '',
    });
    setEditingGameId(null);
  };

  const startEditing = (game: ScheduledGame) => {
    setEditingGameId(game.game_id);
    setEditInputs({ game_date: game.date, game_time: game.time });
    setScoringGameId(null);
  };

  const handleSaveScore = async (gameId: string) => {
    const t1 = parseInt(scoreInputs.team1, 10);
    const t2 = parseInt(scoreInputs.team2, 10);
    if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0) return;
    setSaving(true);
    try {
      await onUpdateGame(gameId, { team1_score: t1, team2_score: t2 });
      setScoringGameId(null);
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (gameId: string) => {
    if (!editInputs.game_date || !editInputs.game_time) return;
    setSaving(true);
    try {
      await onUpdateGame(gameId, { game_date: editInputs.game_date, game_time: editInputs.game_time });
      setEditingGameId(null);
    } finally { setSaving(false); }
  };

  const statusDot = (status: string) => {
    const color =
      status === 'completed' ? 'bg-accent' :
      status === 'in_progress' ? 'bg-blue-400' :
      status === 'cancelled' ? 'bg-red-500' :
      'bg-[#6B6B6B]';
    return <span className={`status-dot ${color}`} />;
  };

  const weeks = Object.keys(schedule.schedule_by_week).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      {weeks.map((week) => (
        <div key={week}>
          <div className="section-label mb-3">Week {week}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schedule.schedule_by_week[week].map((game) => (
              <div key={game.game_id} className="admin-surface p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{game.team1_name} vs {game.team2_name}</div>
                    <div className="text-xs text-[#6B6B6B] mt-0.5">
                      {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {game.time}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusDot(game.status)}
                    <span className={`text-xs text-[#A0A0A0] ${game.status === 'cancelled' ? 'line-through' : ''}`}>{game.status}</span>
                  </div>
                </div>

                {game.status === 'completed' && game.team1_score != null && game.team2_score != null && (
                  <div className="text-xs font-medium text-[#A0A0A0] bg-white/5 rounded px-2.5 py-1.5 mb-2 text-center">
                    {game.team1_name} <span className="text-white font-semibold">{game.team1_score}</span> &#8212; <span className="text-white font-semibold">{game.team2_score}</span> {game.team2_name}
                  </div>
                )}

                {scoringGameId === game.game_id ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-[#6B6B6B] block mb-1">{game.team1_name}</label>
                        <input type="number" min="0" value={scoreInputs.team1}
                          onChange={(e) => setScoreInputs({ ...scoreInputs, team1: e.target.value })}
                          className={inputCls + ' text-center'} />
                      </div>
                      <div>
                        <label className="text-xs text-[#6B6B6B] block mb-1">{game.team2_name}</label>
                        <input type="number" min="0" value={scoreInputs.team2}
                          onChange={(e) => setScoreInputs({ ...scoreInputs, team2: e.target.value })}
                          className={inputCls + ' text-center'} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveScore(game.game_id)} disabled={saving}
                        className="flex-1 text-xs font-medium text-accent px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-accent/20 disabled:opacity-50">
                        {saving ? 'Saving\u2026' : 'Save Score'}
                      </button>
                      <button onClick={() => setScoringGameId(null)}
                        className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : editingGameId === game.game_id ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-[#6B6B6B] block mb-1">Date</label>
                        <input type="date" value={editInputs.game_date}
                          onChange={(e) => setEditInputs({ ...editInputs, game_date: e.target.value })}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[#6B6B6B] block mb-1">Time</label>
                        <input type="time" value={editInputs.game_time}
                          onChange={(e) => setEditInputs({ ...editInputs, game_time: e.target.value })}
                          className={inputCls} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(game.game_id)} disabled={saving}
                        className="flex-1 text-xs font-medium text-accent px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-accent/20 disabled:opacity-50">
                        {saving ? 'Saving\u2026' : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditingGameId(null)}
                        className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : game.status !== 'cancelled' && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {game.status !== 'completed' && (
                      <button onClick={() => startScoring(game)}
                        className="text-xs text-[#A0A0A0] hover:text-white px-2.5 py-1 rounded hover:bg-white/5 transition-colors">
                        Record Score
                      </button>
                    )}
                    {game.status === 'completed' && (
                      <button onClick={() => startScoring(game)}
                        className="text-xs text-[#A0A0A0] hover:text-white px-2.5 py-1 rounded hover:bg-white/5 transition-colors">
                        Edit Score
                      </button>
                    )}
                    <button onClick={() => startEditing(game)}
                      className="text-xs text-[#A0A0A0] hover:text-white px-2.5 py-1 rounded hover:bg-white/5 transition-colors">
                      Reschedule
                    </button>
                    <button onClick={() => onCancelGame(game.game_id)} disabled={saving}
                      className="text-xs text-[#A0A0A0] hover:text-red-400 px-2.5 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50">
                      Cancel Game
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
