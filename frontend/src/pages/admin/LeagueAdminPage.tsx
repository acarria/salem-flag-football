import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import BaseLayout from '../../components/layout/BaseLayout';
import {
  League, LeagueMember, Field, Team, LeagueSchedule, ScheduledGame,
  GameUpdateRequest, LeagueCreateRequest, LeagueUpdateRequest, TournamentFormat
} from '../../services';
import { useAuthenticatedApi } from '../../hooks/useAuthenticatedApi';
import InlineEditableField from '../../components/common/InlineEditableField';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type GameFormat = '7v7' | '6v6' | '5v5';

const inputCls =
  'w-full px-2.5 py-1.5 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors';

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [activeSection, setActiveSection] = useState('overview');
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedule, setSchedule] = useState<LeagueSchedule | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [leagueFormData, setLeagueFormData] = useState<Partial<LeagueCreateRequest>>({});

  const [confirmCancelGame, setConfirmCancelGame] = useState<string | null>(null);

  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    if (!isSignedIn || !leagueId) { navigate('/admin'); return; }
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (userEmail !== 'alexcarria1@gmail.com') { navigate('/admin'); return; }
    loadAll();
  }, [isSignedIn, leagueId, user, navigate]);

  const loadAll = async () => {
    if (!leagueId) return;
    setIsLoading(true);
    try {
      const [leagueData, membersData, fieldsData, allFieldsData, teamsData, scheduleData] = await Promise.all([
        authenticatedRequest<League>(`/admin/leagues/${leagueId}`),
        authenticatedRequest<LeagueMember[]>(`/admin/leagues/${leagueId}/members`),
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
        authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`),
        authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`).catch(() => null),
      ]);
      setLeague(leagueData);
      setMembers(membersData);
      setFields(fieldsData);
      setAllFields(allFieldsData);
      setTeams(teamsData);
      setSchedule(scheduleData);
      populateFormData(leagueData);
    } catch (err) {
      setError('Failed to load league data.');
    } finally {
      setIsLoading(false);
    }
  };

  const populateFormData = (l: League) => {
    setLeagueFormData({
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
      regular_season_weeks: l.regular_season_weeks || undefined,
      playoff_weeks: l.playoff_weeks || undefined,
      swiss_rounds: l.swiss_rounds || undefined,
      playoff_teams: l.playoff_teams || undefined,
      playoff_format: l.playoff_format || undefined,
    });
  };

  const handleLeagueInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setLeagueFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleUpdateLeague = async () => {
    if (!leagueId || !league) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await authenticatedRequest<League>(`/admin/leagues/${leagueId}`, {
        method: 'PUT',
        body: JSON.stringify(leagueFormData as LeagueUpdateRequest),
      });
      setSuccess('League updated!');
      setIsEditingOverview(false);
      setLeague(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update league.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssociateField = async (fieldId: string) => {
    if (!leagueId) return;
    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, { method: 'POST' });
      setSuccess('Field added!');
      const [f, af] = await Promise.all([
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
      ]);
      setFields(f);
      setAllFields(af);
    } catch (err: any) {
      setError(err.message || 'Failed to associate field.');
    }
  };

  const handleDisassociateField = async (fieldId: string) => {
    if (!leagueId) return;
    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, { method: 'DELETE' });
      setSuccess('Field removed!');
      const [f, af] = await Promise.all([
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
      ]);
      setFields(f);
      setAllFields(af);
    } catch (err: any) {
      setError(err.message || 'Failed to disassociate field.');
    }
  };

  const handleUpdateGame = async (gameId: string, data: GameUpdateRequest) => {
    if (!leagueId) return;
    try {
      await authenticatedRequest(`/admin/leagues/${leagueId}/games/${gameId}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
      setSuccess('Game updated!');
      const scheduleData = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
      setSchedule(scheduleData);
    } catch (err: any) {
      setError(err.message || 'Failed to update game.');
    }
  };

  // IntersectionObserver for sidebar active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [league]);

  if (!isSignedIn || (!league && !isLoading)) return null;
  if (isLoading && !league) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-sm text-[#6B6B6B]">Loading…</div>
        </div>
      </BaseLayout>
    );
  }
  if (!league) return null;

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'fields', label: 'Fields' },
    { id: 'teams', label: 'Teams' },
    { id: 'schedule', label: 'Schedule' },
  ];

  const unassociatedFields = allFields.filter(
    (f) => !fields.some((af) => af.id === f.id) && f.is_active
  );

  return (
    <BaseLayout>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] w-56 bg-[#0D0D0D] border-r border-white/5 p-6 flex-shrink-0">
          <Link
            to="/admin"
            className="text-xs text-[#6B6B6B] hover:text-white transition-colors flex items-center gap-1.5 mb-6"
          >
            ← Dashboard
          </Link>

          <div className="mb-1">
            <div className="text-sm font-semibold text-white truncate">{league.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`status-dot ${league.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
              <span className="text-xs text-[#6B6B6B]">{league.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <hr className="border-white/5 my-4" />

          <nav className="space-y-0.5">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === sec.id
                    ? 'text-white bg-white/5'
                    : 'text-[#6B6B6B] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {sec.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main scrollable content */}
        <main className="flex-1 px-6 lg:px-10 py-8 space-y-16 max-w-4xl">
          {/* Status messages */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex justify-between">
              {error}
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-4">✕</button>
            </div>
          )}
          {success && (
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent text-sm flex justify-between">
              {success}
              <button onClick={() => setSuccess(null)} className="text-accent/60 hover:text-accent ml-4">✕</button>
            </div>
          )}

          {/* Overview Section */}
          <section
            id="overview"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.overview = el; }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Overview</h2>
              {!isEditingOverview ? (
                <button
                  onClick={() => setIsEditingOverview(true)}
                  className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors border border-white/10"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateLeague}
                    disabled={isLoading}
                    className="text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => { setIsEditingOverview(false); populateFormData(league); }}
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
                value={leagueFormData.name}
                isEditing={isEditingOverview}
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Description"
                name="description"
                value={leagueFormData.description}
                isEditing={isEditingOverview}
                type="textarea"
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Start Date"
                name="start_date"
                value={leagueFormData.start_date}
                displayValue={league.start_date ? new Date(league.start_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                isEditing={isEditingOverview}
                type="date"
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Game Format"
                name="format"
                value={leagueFormData.format}
                isEditing={isEditingOverview}
                type="select"
                options={[{ value: '7v7', label: '7v7' }, { value: '6v6', label: '6v6' }, { value: '5v5', label: '5v5' }]}
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Tournament Format"
                name="tournament_format"
                value={leagueFormData.tournament_format}
                displayValue={league.tournament_format.replace(/_/g, ' ')}
                isEditing={isEditingOverview}
                type="select"
                options={[
                  { value: 'round_robin', label: 'Round Robin' },
                  { value: 'swiss', label: 'Swiss' },
                  { value: 'playoff_bracket', label: 'Playoff Bracket' },
                  { value: 'compass_draw', label: 'Compass Draw' },
                ]}
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Weeks"
                name="num_weeks"
                value={leagueFormData.num_weeks}
                isEditing={isEditingOverview}
                type="number"
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Game Duration (min)"
                name="game_duration"
                value={leagueFormData.game_duration}
                isEditing={isEditingOverview}
                type="number"
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Games Per Week"
                name="games_per_week"
                value={leagueFormData.games_per_week}
                isEditing={isEditingOverview}
                type="number"
                onChange={handleLeagueInputChange}
              />
              <InlineEditableField
                label="Registration Fee"
                name="registration_fee"
                value={leagueFormData.registration_fee}
                displayValue={`$${typeof league.registration_fee === 'number' ? league.registration_fee.toFixed(2) : Number(league.registration_fee || 0).toFixed(2)}`}
                isEditing={isEditingOverview}
                type="number"
                onChange={handleLeagueInputChange}
              />
              {/* Read-only stats */}
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
          </section>

          {/* Members Section */}
          <section
            id="members"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.members = el; }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Members <span className="text-[#6B6B6B] font-normal ml-1">({members.length})</span></h2>
              <button
                onClick={async () => {
                  try {
                    const data = await authenticatedRequest<LeagueMember[]>(`/admin/leagues/${leagueId}/members`);
                    setMembers(data);
                  } catch { /* ignore */ }
                }}
                className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
                title="Refresh"
              >
                ↺
              </button>
            </div>

            <div className="admin-surface overflow-hidden">
              {members.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#6B6B6B]">No members registered yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Name', 'Email', 'Team', 'Group', 'Status', 'Payment', 'Waiver'].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="admin-row">
                          <td className="py-2.5 px-3 text-sm text-white">{m.first_name} {m.last_name}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.email}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.team_name || '—'}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.group_name || '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`status-dot ${m.registration_status === 'registered' ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                              <span className="text-xs text-[#A0A0A0]">{m.registration_status}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`status-dot ${m.payment_status === 'paid' ? 'bg-accent' : m.payment_status === 'pending' ? 'bg-yellow-500' : 'bg-[#6B6B6B]'}`} />
                              <span className="text-xs text-[#A0A0A0]">{m.payment_status}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`status-dot ${m.waiver_status === 'signed' ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                              <span className="text-xs text-[#A0A0A0]">{m.waiver_status}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Fields Section */}
          <section
            id="fields"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.fields = el; }}
          >
            <div className="mb-6">
              <h2 className="text-base font-semibold text-white">Fields <span className="text-[#6B6B6B] font-normal ml-1">({fields.length})</span></h2>
            </div>

            {/* Assigned fields */}
            <div className="admin-surface overflow-hidden mb-4">
              {fields.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#6B6B6B]">No fields associated yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Name', 'Field #', 'Facility', 'Address'].map((h) => (
                        <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">{h}</th>
                      ))}
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.id} className="admin-row">
                        <td className="py-2.5 px-3 text-sm text-white">{field.name}</td>
                        <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.field_number || '—'}</td>
                        <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.facility_name || '—'}</td>
                        <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.street_address}, {field.city}, {field.state}</td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleDisassociateField(field.id)}
                            className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Available field chips */}
            {unassociatedFields.length > 0 && (
              <div>
                <div className="section-label mb-3">Available to add</div>
                <div className="flex flex-wrap gap-2">
                  {unassociatedFields.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => handleAssociateField(field.id)}
                      className="text-xs border border-white/10 hover:border-accent/40 text-[#A0A0A0] hover:text-white rounded-full px-3 py-1.5 transition-colors"
                    >
                      + {field.name}{field.field_number ? ` #${field.field_number}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Teams Section */}
          <section
            id="teams"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.teams = el; }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Teams <span className="text-[#6B6B6B] font-normal ml-1">({teams.length})</span></h2>
              <button
                onClick={async () => {
                  try {
                    const data = await authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`);
                    setTeams(data);
                  } catch { /* ignore */ }
                }}
                className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
                title="Refresh"
              >
                ↺
              </button>
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
          </section>

          {/* Schedule Section */}
          <section
            id="schedule"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.schedule = el; }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Schedule</h2>
                {schedule && schedule.total_games > 0 && (
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{schedule.total_games} games</p>
                )}
              </div>
              <button
                onClick={async () => {
                  try {
                    const data = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
                    setSchedule(data);
                  } catch { /* ignore */ }
                }}
                className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
                title="Refresh"
              >
                ↺
              </button>
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
          </section>
        </main>
      </div>

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
    </BaseLayout>
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
                    {game.team1_name} <span className="text-white font-semibold">{game.team1_score}</span> — <span className="text-white font-semibold">{game.team2_score}</span> {game.team2_name}
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
                        {saving ? 'Saving…' : 'Save Score'}
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
                        {saving ? 'Saving…' : 'Save Changes'}
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
