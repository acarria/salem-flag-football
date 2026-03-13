import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import {
  League, LeagueCreateRequest, AdminConfig, AdminConfigCreateRequest,
  User, PaginatedUserResponse, Field, FieldCreateRequest, FieldUpdateRequest
} from '../services';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import { LeagueFormModal } from './admin/components';
import ConfirmDialog from '../components/common/ConfirmDialog';

type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
type GameFormat = '7v7' | '6v6' | '5v5';

const inputCls =
  'w-full px-2.5 py-1.5 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
const selectCls = inputCls + ' bg-[#1E1E1E]';

export default function AdminPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // League creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<Partial<LeagueCreateRequest>>({
    name: '', description: '', start_date: '', num_weeks: 8,
    format: '7v7', tournament_format: 'round_robin', game_duration: 60,
    games_per_week: 1, min_teams: 4,
  });

  // Admins inline section
  const [admins, setAdmins] = useState<AdminConfig[]>([]);
  const [adminFormData, setAdminFormData] = useState<Partial<AdminConfigCreateRequest>>({ email: '', role: 'admin' });
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<string | null>(null);

  // Users section
  const [usersData, setUsersData] = useState<PaginatedUserResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(25);

  // Fields inline section
  const [fields, setFields] = useState<Field[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldDraft, setFieldDraft] = useState<Partial<FieldCreateRequest>>({
    name: '', field_number: '', street_address: '', city: '',
    state: '', zip_code: '', country: 'USA', facility_name: '', additional_notes: '',
  });
  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null);
  const [isSavingField, setIsSavingField] = useState(false);

  // Confirm delete league
  const [confirmDeleteLeague, setConfirmDeleteLeague] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) { navigate('/'); return; }
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (userEmail !== 'alexcarria1@gmail.com') { navigate('/'); return; }
    loadLeagues();
    loadAdmins();
    loadUsers(1);
    loadAllFields();
  }, [isSignedIn, user, navigate]);

  const loadLeagues = async () => {
    setIsLoading(true);
    try {
      const data = await authenticatedRequest<League[]>('/admin/leagues');
      setLeagues(data);
    } catch { setError('Failed to load leagues.'); } finally { setIsLoading(false); }
  };

  const loadAdmins = async () => {
    try {
      const data = await authenticatedRequest<AdminConfig[]>('/admin/admins');
      setAdmins(data);
    } catch { /* silent */ }
  };

  const loadUsers = async (page: number) => {
    setIsLoadingUsers(true);
    try {
      const data = await authenticatedRequest<PaginatedUserResponse>(`/admin/users?page=${page}&page_size=${usersPageSize}`);
      setUsersData(data);
      setUsersPage(page);
    } catch { setError('Failed to load users.'); } finally { setIsLoadingUsers(false); }
  };

  const loadAllFields = async () => {
    try {
      const data = await authenticatedRequest<Field[]>('/admin/fields');
      setFields(Array.isArray(data) ? data : []);
    } catch { setFields([]); }
  };

  // League
  const handleCreateLeague = async () => {
    if (!formData.name || !formData.start_date || !formData.num_weeks) {
      setError('Name, start date, and number of weeks are required'); return;
    }
    try {
      await authenticatedRequest<League>('/admin/leagues', { method: 'POST', body: JSON.stringify(formData) });
      setSuccess('League created!');
      setShowCreateModal(false);
      resetLeagueForm();
      loadLeagues();
    } catch { setError('Failed to create league.'); }
  };

  const handleDeleteLeague = async (id: string) => {
    try {
      await authenticatedRequest(`/admin/leagues/${id}`, { method: 'DELETE' });
      setSuccess('League deleted!');
      loadLeagues();
    } catch { setError('Failed to delete league.'); }
    setConfirmDeleteLeague(null);
  };

  const resetLeagueForm = () => setFormData({
    name: '', description: '', start_date: '', num_weeks: 8,
    format: '7v7', tournament_format: 'round_robin', game_duration: 60,
    games_per_week: 1, min_teams: 4,
  });

  const getTournamentFormatDescription = (format: TournamentFormat) => {
    switch (format) {
      case 'round_robin': return 'Each team plays every other team once';
      case 'swiss': return 'Teams paired against opponents with similar records';
      case 'playoff_bracket': return 'Regular season followed by elimination tournament';
      case 'compass_draw': return 'Teams play in compass directions (N, S, E, W)';
      default: return '';
    }
  };

  // Admins
  const handleAddAdmin = async () => {
    if (!adminFormData.email) { setError('Email is required'); return; }
    try {
      await authenticatedRequest<AdminConfig>('/admin/admins', { method: 'POST', body: JSON.stringify(adminFormData) });
      setSuccess('Admin added!');
      setAdminFormData({ email: '', role: 'admin' });
      loadAdmins();
    } catch { setError('Failed to add admin.'); }
  };

  const handleRemoveAdmin = async (email: string) => {
    try {
      await authenticatedRequest(`/admin/admins/${email}`, { method: 'DELETE' });
      setSuccess('Admin removed!');
      loadAdmins();
    } catch { setError('Failed to remove admin.'); }
    setConfirmRemoveAdmin(null);
  };

  // Fields
  const startEditField = (field: Field) => {
    setEditingFieldId(field.id);
    setFieldDraft({
      name: field.name, field_number: field.field_number || '',
      street_address: field.street_address, city: field.city,
      state: field.state, zip_code: field.zip_code,
      country: field.country, facility_name: field.facility_name || '',
      additional_notes: field.additional_notes || '',
    });
  };

  const handleSaveField = async (fieldId: string) => {
    setIsSavingField(true);
    try {
      await authenticatedRequest<Field>(`/admin/fields/${fieldId}`, { method: 'PUT', body: JSON.stringify(fieldDraft) });
      setSuccess('Field updated!');
      setEditingFieldId(null);
      resetFieldDraft();
      loadAllFields();
    } catch { setError('Failed to update field.'); } finally { setIsSavingField(false); }
  };

  const handleCreateField = async () => {
    if (!fieldDraft.name || !fieldDraft.street_address || !fieldDraft.city || !fieldDraft.state || !fieldDraft.zip_code) {
      setError('Fill in all required fields'); return;
    }
    setIsSavingField(true);
    try {
      await authenticatedRequest<Field>('/admin/fields', { method: 'POST', body: JSON.stringify(fieldDraft) });
      setSuccess('Field created!');
      setIsAddingField(false);
      resetFieldDraft();
      loadAllFields();
    } catch { setError('Failed to create field.'); } finally { setIsSavingField(false); }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      await authenticatedRequest(`/admin/fields/${fieldId}`, { method: 'DELETE' });
      setSuccess('Field deleted!');
      loadAllFields();
    } catch { setError('Failed to delete field.'); }
    setConfirmDeleteField(null);
  };

  const resetFieldDraft = () => setFieldDraft({
    name: '', field_number: '', street_address: '', city: '',
    state: '', zip_code: '', country: 'USA', facility_name: '', additional_notes: '',
  });

  const handleFieldDraftChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFieldDraft(prev => ({ ...prev, [name]: value }));
  };

  if (!isSignedIn) return null;

  const activeLeagues = leagues.filter(l => l.is_active).length;

  return (
    <BaseLayout>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-16">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Admin Dashboard</h1>
          <p className="text-sm text-[#6B6B6B]">Manage leagues, fields, users, and admins</p>
        </div>

        {/* Status Messages */}
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

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leagues', value: leagues.length },
            { label: 'Active Leagues', value: activeLeagues },
            { label: 'Total Admins', value: admins.length },
            { label: 'Total Fields', value: fields.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111111] border border-white/5 rounded-xl p-5">
              <div className="text-xs text-[#6B6B6B] mb-1">{stat.label}</div>
              <div className="text-2xl font-semibold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Leagues Section */}
        <section id="leagues">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Leagues</h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">{leagues.length} total</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm font-medium bg-accent text-white px-3.5 py-1.5 rounded-md hover:bg-accent-dark transition-colors"
            >
              + Create League
            </button>
          </div>

          <div className="admin-surface overflow-hidden">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-[#6B6B6B]">Loading leagues…</div>
            ) : leagues.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#6B6B6B]">No leagues yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden md:table-cell">Format</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden md:table-cell">Status</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium hidden sm:table-cell">Players</th>
                    <th className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {leagues.map((league) => (
                    <tr key={league.id} className="admin-row">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-white">{league.name}</div>
                        <div className="text-xs text-[#6B6B6B] mt-0.5 md:hidden">{league.format} · {league.is_active ? 'Active' : 'Inactive'}</div>
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
                            to={`/admin/leagues/${league.id}`}
                            className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                          >
                            Manage →
                          </Link>
                          <button
                            onClick={() => setConfirmDeleteLeague(league.id)}
                            className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Fields Section */}
        <section id="fields">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Fields</h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">{fields.length} configured</p>
            </div>
          </div>

          <div className="admin-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Name', 'Field #', 'Facility', 'Address', 'City / State', 'Active'].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 && !isAddingField && (
                    <tr><td colSpan={7} className="py-10 text-center text-sm text-[#6B6B6B]">No fields yet.</td></tr>
                  )}
                  {fields.map((field) => {
                    const isEditing = editingFieldId === field.id;
                    return (
                      <tr key={field.id} className={`admin-row ${isEditing ? 'bg-white/[0.04]' : ''}`}>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="name" value={fieldDraft.name || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-white font-medium">{field.name}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="field_number" value={fieldDraft.field_number || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.field_number || '—'}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="facility_name" value={fieldDraft.facility_name || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.facility_name || '—'}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="street_address" value={fieldDraft.street_address || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.street_address}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input name="city" value={fieldDraft.city || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="City" />
                              <input name="state" value={fieldDraft.state || ''} onChange={handleFieldDraftChange} className={inputCls + ' w-16'} placeholder="MA" />
                            </div>
                          ) : (
                            <span className="text-[#A0A0A0]">{field.city}, {field.state}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          <span className={`status-dot ${field.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveField(field.id)}
                                  disabled={isSavingField}
                                  className="text-xs text-accent hover:text-accent px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                  {isSavingField ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={() => { setEditingFieldId(null); resetFieldDraft(); }} className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditField(field)}
                                  disabled={!!editingFieldId || isAddingField}
                                  className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteField(field.id)}
                                  disabled={!!editingFieldId || isAddingField}
                                  className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* New field row */}
                  {isAddingField && (
                    <tr className="bg-white/[0.04] border-b border-white/5">
                      <td className="py-2.5 px-3"><input name="name" value={fieldDraft.name || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Name *" /></td>
                      <td className="py-2.5 px-3"><input name="field_number" value={fieldDraft.field_number || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="#" /></td>
                      <td className="py-2.5 px-3"><input name="facility_name" value={fieldDraft.facility_name || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Facility" /></td>
                      <td className="py-2.5 px-3"><input name="street_address" value={fieldDraft.street_address || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Address *" /></td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <input name="city" value={fieldDraft.city || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="City *" />
                          <input name="state" value={fieldDraft.state || ''} onChange={handleFieldDraftChange} className={inputCls + ' w-16'} placeholder="MA *" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3"><input name="zip_code" value={fieldDraft.zip_code || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="ZIP *" /></td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={handleCreateField}
                            disabled={isSavingField}
                            className="text-xs text-accent px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                          >
                            {isSavingField ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setIsAddingField(false); resetFieldDraft(); }}
                            className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!isAddingField && (
              <div className="px-3 py-3 border-t border-white/5">
                <button
                  onClick={() => { setIsAddingField(true); resetFieldDraft(); }}
                  disabled={!!editingFieldId}
                  className="text-xs text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1.5"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Add field</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Users Section */}
        <section id="users">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Users</h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">{usersData?.total ?? 0} registered</p>
            </div>
            <button
              onClick={() => loadUsers(usersPage)}
              className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
              title="Refresh"
            >
              ↺
            </button>
          </div>

          <div className="admin-surface overflow-hidden">
            {isLoadingUsers ? (
              <div className="py-12 text-center text-sm text-[#6B6B6B]">Loading users…</div>
            ) : usersData && usersData.users.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Name', 'Email', 'Phone', 'Gender', 'Status', 'Leagues', 'Joined'].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.users.map((u) => (
                        <tr key={u.clerk_user_id} className="admin-row">
                          <td className="py-2.5 px-3 text-sm text-white">{u.first_name} {u.last_name}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.email}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.phone || '—'}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.gender || '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`status-dot ${u.registration_status === 'registered' || u.registration_status === 'active' ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                              <span className="text-xs text-[#A0A0A0]">{u.registration_status}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.leagues_count}</td>
                          <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">
                            {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {usersData.total_pages > 1 && (
                  <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-[#6B6B6B]">
                      {(usersPage - 1) * usersPageSize + 1}–{Math.min(usersPage * usersPageSize, usersData.total)} of {usersData.total}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => loadUsers(usersPage - 1)}
                        disabled={usersPage === 1}
                        className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[#6B6B6B]">Page {usersPage} of {usersData.total_pages}</span>
                      <button
                        onClick={() => loadUsers(usersPage + 1)}
                        disabled={usersPage === usersData.total_pages}
                        className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-[#6B6B6B]">No users found.</div>
            )}
          </div>
        </section>

        {/* Admins Section */}
        <section id="admins">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Admins</h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">{admins.length} configured</p>
          </div>

          <div className="admin-surface overflow-hidden">
            {/* Admins list */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Role</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="admin-row">
                    <td className="py-3 px-4 text-sm text-white">{admin.email}</td>
                    <td className="py-3 px-4 text-sm text-[#A0A0A0]">{admin.role}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setConfirmRemoveAdmin(admin.email)}
                        disabled={admin.email === 'alexcarria1@gmail.com'}
                        className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add admin form */}
            <div className="px-4 py-4 border-t border-white/5">
              <div className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-3">Add Admin</div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <input
                    type="email"
                    name="email"
                    value={adminFormData.email}
                    onChange={(e) => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="admin@example.com"
                    className={inputCls}
                  />
                </div>
                <div className="w-40">
                  <select
                    name="role"
                    value={adminFormData.role}
                    onChange={(e) => setAdminFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    className={selectCls}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <button
                  onClick={handleAddAdmin}
                  disabled={!adminFormData.email}
                  className="text-sm font-medium bg-accent text-white px-3.5 py-1.5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <LeagueFormModal
          title="Create New League"
          formData={formData}
          onInputChange={(e) => {
            const { name, value, type } = e.target;
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
          }}
          onSubmit={handleCreateLeague}
          onCancel={() => { setShowCreateModal(false); resetLeagueForm(); }}
          isLoading={isLoading}
          getTournamentFormatDescription={getTournamentFormatDescription}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteLeague}
        title="Delete League"
        message="Are you sure you want to delete this league? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDeleteLeague && handleDeleteLeague(confirmDeleteLeague)}
        onCancel={() => setConfirmDeleteLeague(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteField}
        title="Delete Field"
        message="Are you sure you want to delete this field? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDeleteField && handleDeleteField(confirmDeleteField)}
        onCancel={() => setConfirmDeleteField(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmRemoveAdmin}
        title="Remove Admin"
        message="Are you sure you want to remove this admin?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => confirmRemoveAdmin && handleRemoveAdmin(confirmRemoveAdmin)}
        onCancel={() => setConfirmRemoveAdmin(null)}
      />
    </BaseLayout>
  );
}
