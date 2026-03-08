import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import BaseLayout from '../../components/layout/BaseLayout';
import { League, LeagueMember, Field, Team, LeagueSchedule, ScheduledGame, GameUpdateRequest, LeagueCreateRequest, LeagueUpdateRequest, TournamentFormat } from '../../services';
import { useAuthenticatedApi } from '../../hooks/useAuthenticatedApi';
import { LeagueFieldAssociationModal, LeagueFormModal } from './components';

type TabType = 'overview' | 'members' | 'fields' | 'teams' | 'schedule';
type GameFormat = '7v7' | '6v6' | '5v5';

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [fields, setFields] = useState<Field[]>([]); // Fields associated with this league
  const [allFields, setAllFields] = useState<Field[]>([]); // All available fields
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedule, setSchedule] = useState<LeagueSchedule | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [leagueFormData, setLeagueFormData] = useState<Partial<LeagueCreateRequest>>({
    name: '',
    description: '',
    start_date: '',
    num_weeks: 8,
    format: '7v7',
    tournament_format: 'round_robin',
    game_duration: 60,
    games_per_week: 1,
    min_teams: 4,
    max_teams: undefined,
    registration_deadline: '',
    registration_fee: undefined,
    regular_season_weeks: undefined,
    playoff_weeks: undefined,
    swiss_rounds: undefined,
    swiss_pairing_method: undefined,
    compass_draw_rounds: undefined,
    playoff_teams: undefined,
    playoff_format: undefined,
  });

  useEffect(() => {
    if (!isSignedIn || !leagueId) {
      navigate('/admin');
      return;
    }

    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    const adminEmail = 'alexcarria1@gmail.com';
    
    if (userEmail !== adminEmail) {
      navigate('/admin');
      return;
    }

    loadLeagueData();
  }, [isSignedIn, leagueId, user, navigate]);

  const loadLeagueData = async () => {
    if (!leagueId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const leagueData = await authenticatedRequest<League>(`/admin/leagues/${leagueId}`);
      setLeague(leagueData);
    } catch (err) {
      console.error('Failed to load league:', err);
      setError('Failed to load league data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!leagueId) return;
    
    try {
      const membersData = await authenticatedRequest<LeagueMember[]>(`/admin/leagues/${leagueId}/members`);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError('Failed to load members. Please try again.');
    }
  };

  const loadFields = async () => {
    if (!leagueId) return;
    
    try {
      const fieldsData = await authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`);
      setFields(fieldsData);
    } catch (err) {
      console.error('Failed to load fields:', err);
      setError('Failed to load fields. Please try again.');
    }
  };

  const loadAllFields = async () => {
    try {
      // Load all available fields for the association modal
      const allFieldsData = await authenticatedRequest<Field[]>(`/admin/fields`);
      setAllFields(allFieldsData);
    } catch (err) {
      console.error('Failed to load all fields:', err);
      // Don't show error for this as it's not critical
    }
  };

  const loadTeams = async () => {
    if (!leagueId) return;
    
    try {
      const teamsData = await authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`);
      setTeams(teamsData);
    } catch (err) {
      console.error('Failed to load teams:', err);
      setError('Failed to load teams. Please try again.');
    }
  };

  const loadSchedule = async () => {
    if (!leagueId) return;
    
    try {
      const scheduleData = await authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`);
      setSchedule(scheduleData);
    } catch (err) {
      console.error('Failed to load schedule:', err);
      setError('Failed to load schedule. Please try again.');
    }
  };

  useEffect(() => {
    if (!leagueId) return;
    
    switch (activeTab) {
      case 'members':
        loadMembers();
        break;
      case 'fields':
        loadFields();
        loadAllFields(); // Also load all fields when viewing fields tab
        break;
      case 'teams':
        loadTeams();
        break;
      case 'schedule':
        loadSchedule();
        break;
    }
  }, [activeTab, leagueId]);

  // Field association handlers
  const handleAssociateField = async (fieldId: string) => {
    if (!leagueId) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
        method: 'POST',
      });
      
      setSuccess('Field associated with league successfully!');
      // Reload both associated fields and all fields to update the modal
      await Promise.all([loadFields(), loadAllFields()]);
    } catch (err: any) {
      console.error('Failed to associate field:', err);
      let errorMessage = 'Failed to associate field. Please try again.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisassociateField = async (fieldId: string) => {
    if (!leagueId) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
        method: 'DELETE',
      });
      
      setSuccess('Field disassociated from league successfully!');
      // Reload both associated fields and all fields to update the modal
      await Promise.all([loadFields(), loadAllFields()]);
    } catch (err: any) {
      console.error('Failed to disassociate field:', err);
      let errorMessage = 'Failed to disassociate field. Please try again.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // League editing handlers
  const openEditModal = () => {
    if (!league) return;
    
    setLeagueFormData({
      name: league.name,
      description: league.description || '',
      start_date: league.start_date,
      num_weeks: league.num_weeks,
      format: league.format as GameFormat,
      tournament_format: league.tournament_format as TournamentFormat,
      game_duration: league.game_duration,
      games_per_week: league.games_per_week,
      min_teams: league.min_teams,
      max_teams: league.max_teams || undefined,
      registration_deadline: league.registration_deadline || '',
      registration_fee: typeof league.registration_fee === 'number' ? league.registration_fee : (league.registration_fee ? Number(league.registration_fee) : undefined),
      regular_season_weeks: league.regular_season_weeks || undefined,
      playoff_weeks: league.playoff_weeks || undefined,
      swiss_rounds: league.swiss_rounds || undefined,
      swiss_pairing_method: league.swiss_pairing_method || undefined,
      compass_draw_rounds: league.compass_draw_rounds || undefined,
      playoff_teams: league.playoff_teams || undefined,
      playoff_format: league.playoff_format || undefined,
    });
    setShowEditModal(true);
  };

  const handleUpdateLeague = async () => {
    if (!leagueId || !league) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedLeague = await authenticatedRequest<League>(`/admin/leagues/${leagueId}`, {
        method: 'PUT',
        body: JSON.stringify(leagueFormData as LeagueUpdateRequest),
      });
      
      setSuccess('League updated successfully!');
      setShowEditModal(false);
      setLeague(updatedLeague);
      await loadLeagueData();
    } catch (err: any) {
      console.error('Failed to update league:', err);
      let errorMessage = 'Failed to update league. Please try again.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeagueInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setLeagueFormData((prev: Partial<LeagueCreateRequest>) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUpdateGame = async (gameId: string, data: GameUpdateRequest) => {
    if (!leagueId) return;
    setError(null);
    setSuccess(null);
    try {
      await authenticatedRequest(`/admin/leagues/${leagueId}/games/${gameId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      setSuccess('Game updated successfully!');
      await loadSchedule();
    } catch (err: any) {
      setError(err.message || 'Failed to update game.');
    }
  };

  const resetLeagueForm = () => {
    if (!league) return;
    
    setLeagueFormData({
      name: league.name,
      description: league.description || '',
      start_date: league.start_date,
      num_weeks: league.num_weeks,
      format: league.format as GameFormat,
      tournament_format: league.tournament_format as TournamentFormat,
      game_duration: league.game_duration,
      games_per_week: league.games_per_week,
      min_teams: league.min_teams,
      max_teams: league.max_teams || undefined,
      registration_deadline: league.registration_deadline || '',
      registration_fee: typeof league.registration_fee === 'number' ? league.registration_fee : (league.registration_fee ? Number(league.registration_fee) : undefined),
      regular_season_weeks: league.regular_season_weeks || undefined,
      playoff_weeks: league.playoff_weeks || undefined,
      swiss_rounds: league.swiss_rounds || undefined,
      swiss_pairing_method: league.swiss_pairing_method || undefined,
      compass_draw_rounds: league.compass_draw_rounds || undefined,
      playoff_teams: league.playoff_teams || undefined,
      playoff_format: league.playoff_format || undefined,
    });
  };

  const getTournamentFormatDescription = (format: TournamentFormat) => {
    switch (format) {
      case 'round_robin':
        return 'Each team plays every other team once';
      case 'swiss':
        return 'Teams are paired against opponents with similar records';
      case 'playoff_bracket':
        return 'Regular season followed by elimination tournament';
      case 'compass_draw':
        return 'Teams play in compass directions (N, S, E, W)';
      default:
        return '';
    }
  };

  if (!isSignedIn || !league) {
    return null;
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '📊' },
    { id: 'members' as TabType, label: 'Members', icon: '👥' },
    { id: 'fields' as TabType, label: 'Fields', icon: '📍' },
    { id: 'teams' as TabType, label: 'Teams', icon: '🏈' },
    { id: 'schedule' as TabType, label: 'Schedule', icon: '📅' },
  ];

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="mb-4 text-accent hover:text-accent-dark transition-colors flex items-center gap-2"
          >
            ← Back to Admin Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-accent mb-2">{league.name}</h1>
              <p className="text-gray-300">{league.description || 'League administration'}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Status</div>
              <span className={`font-semibold ${league.is_active ? 'text-green-400' : 'text-red-400'}`}>
                {league.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-300">
            {success}
            <button 
              onClick={() => setSuccess(null)}
              className="float-right text-green-400 hover:text-green-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-6">
          {activeTab === 'overview' && (
            <OverviewTab 
              league={league}
              onEdit={openEditModal}
            />
          )}
          
          {activeTab === 'members' && (
            <MembersTab 
              members={members} 
              isLoading={isLoading}
              onRefresh={loadMembers}
            />
          )}
          
          {activeTab === 'fields' && (
            <FieldsTab 
              fields={fields}
              league={league}
              isLoading={isLoading}
              onRefresh={loadFields}
              onManageFields={async () => {
                await loadAllFields(); // Load all fields before opening modal
                setShowFieldModal(true);
              }}
            />
          )}
          
          {showFieldModal && league && (
            <LeagueFieldAssociationModal
              league={league}
              associatedFields={fields}
              allFields={allFields}
              onAssociate={handleAssociateField}
              onDisassociate={handleDisassociateField}
              onCancel={() => {
                setShowFieldModal(false);
              }}
              isLoading={isLoading}
            />
          )}

          {showEditModal && (
            <LeagueFormModal
              title="Edit League"
              formData={leagueFormData}
              onInputChange={handleLeagueInputChange}
              onSubmit={handleUpdateLeague}
              onCancel={() => {
                setShowEditModal(false);
                resetLeagueForm();
              }}
              isLoading={isLoading}
              getTournamentFormatDescription={getTournamentFormatDescription}
            />
          )}
          
          {activeTab === 'teams' && (
            <TeamsTab 
              teams={teams}
              isLoading={isLoading}
              onRefresh={loadTeams}
            />
          )}
          
          {activeTab === 'schedule' && (
            <ScheduleTab
              schedule={schedule}
              isLoading={isLoading}
              onRefresh={loadSchedule}
              onUpdateGame={handleUpdateGame}
            />
          )}
        </div>
      </div>
    </BaseLayout>
  );
}

// Overview Tab Component
function OverviewTab({ 
  league,
  onEdit
}: { 
  league: League;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-accent">League Overview</h2>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors"
        >
          Edit League
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Format</div>
          <div className="text-lg font-semibold text-white">{league.format}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Tournament Format</div>
          <div className="text-lg font-semibold text-white capitalize">{league.tournament_format.replace('_', ' ')}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Game Duration</div>
          <div className="text-lg font-semibold text-white">{league.game_duration} minutes</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Start Date</div>
          <div className="text-lg font-semibold text-white">
            {new Date(league.start_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Number of Weeks</div>
          <div className="text-lg font-semibold text-white">{league.num_weeks}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Games Per Week</div>
          <div className="text-lg font-semibold text-white">{league.games_per_week}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Registered Players</div>
          <div className="text-lg font-semibold text-white">{league.registered_players_count}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Teams</div>
          <div className="text-lg font-semibold text-white">{league.registered_teams_count}</div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Registration Fee</div>
          <div className="text-lg font-semibold text-white">
            ${typeof league.registration_fee === 'number' 
              ? league.registration_fee.toFixed(2) 
              : Number(league.registration_fee || 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Members Tab Component
function MembersTab({ 
  members, 
  isLoading,
  onRefresh 
}: { 
  members: LeagueMember[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-accent">League Members ({members.length})</h2>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="text-accent text-xl">Loading members...</div>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-xl">No members registered yet.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left p-3 text-accent font-semibold">Name</th>
                <th className="text-left p-3 text-accent font-semibold">Email</th>
                <th className="text-left p-3 text-accent font-semibold">Team</th>
                <th className="text-left p-3 text-accent font-semibold">Group</th>
                <th className="text-left p-3 text-accent font-semibold">Status</th>
                <th className="text-left p-3 text-accent font-semibold">Payment</th>
                <th className="text-left p-3 text-accent font-semibold">Waiver</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-700 hover:bg-black hover:bg-opacity-30">
                  <td className="p-3 text-white">
                    {member.first_name} {member.last_name}
                  </td>
                  <td className="p-3 text-gray-300">{member.email}</td>
                  <td className="p-3 text-gray-300">{member.team_name || '-'}</td>
                  <td className="p-3 text-gray-300">{member.group_name || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      member.registration_status === 'registered' ? 'bg-green-900 text-green-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {member.registration_status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      member.payment_status === 'paid' ? 'bg-green-900 text-green-200' :
                      member.payment_status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {member.payment_status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      member.waiver_status === 'signed' ? 'bg-green-900 text-green-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {member.waiver_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Fields Tab Component
function FieldsTab({ 
  fields,
  league,
  isLoading,
  onRefresh,
  onManageFields
}: { 
  fields: Field[];
  league: League;
  isLoading: boolean;
  onRefresh: () => void;
  onManageFields: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-accent">Fields ({fields.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={onManageFields}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-dark transition-colors"
          >
            Manage Fields
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="text-accent text-xl">Loading fields...</div>
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-xl mb-4">No fields configured yet.</div>
          <button
            onClick={onManageFields}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-dark transition-colors"
          >
            Add Your First Field
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div
              key={field.id}
              className={`bg-black bg-opacity-30 rounded-lg p-4 border ${
                field.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-accent">{field.name}</h3>
                  {field.field_number && (
                    <div className="text-sm text-gray-400">#{field.field_number}</div>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    field.is_active
                      ? 'bg-green-900 text-green-200'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {field.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {field.facility_name && (
                <div className="text-sm text-gray-300 mb-2">
                  <span className="text-gray-400">Facility:</span> {field.facility_name}
                </div>
              )}
              
              <div className="text-sm text-gray-300">
                {field.street_address}, {field.city}, {field.state} {field.zip_code}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Teams Tab Component
function TeamsTab({ 
  teams,
  isLoading,
  onRefresh
}: { 
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-accent">Teams ({teams.length})</h2>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="text-accent text-xl">Loading teams...</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-xl">No teams have been created yet.</div>
          <div className="text-gray-500 text-sm mt-2">Generate teams from the main admin dashboard.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-2">
                {team.color && (
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white"
                    style={{ backgroundColor: team.color }}
                  />
                )}
                <h3 className="text-lg font-bold text-white">{team.name}</h3>
              </div>
              <div className="text-sm text-gray-400">
                Team ID: {team.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Schedule Tab Component
function ScheduleTab({
  schedule,
  isLoading,
  onRefresh,
  onUpdateGame,
}: {
  schedule: LeagueSchedule | null;
  isLoading: boolean;
  onRefresh: () => void;
  onUpdateGame: (gameId: string, data: GameUpdateRequest) => Promise<void>;
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
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (gameId: string) => {
    if (!editInputs.game_date || !editInputs.game_time) return;
    setSaving(true);
    try {
      await onUpdateGame(gameId, { game_date: editInputs.game_date, game_time: editInputs.game_time });
      setEditingGameId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelGame = async (gameId: string) => {
    if (!window.confirm('Cancel this game?')) return;
    setSaving(true);
    try {
      await onUpdateGame(gameId, { status: 'cancelled' });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const cls =
      status === 'completed' ? 'bg-green-900 text-green-200' :
      status === 'in_progress' ? 'bg-blue-900 text-blue-200' :
      status === 'cancelled' ? 'bg-red-900 text-red-300 line-through' :
      'bg-gray-700 text-gray-300';
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>{status}</span>;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-accent text-xl">Loading schedule...</div>
      </div>
    );
  }

  if (!schedule || schedule.total_games === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-accent">Schedule</h2>
          <button onClick={onRefresh} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
            Refresh
          </button>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 text-xl">No schedule has been generated yet.</div>
          <div className="text-gray-500 text-sm mt-2">Generate schedule from the main admin dashboard.</div>
        </div>
      </div>
    );
  }

  const weeks = Object.keys(schedule.schedule_by_week).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-accent">Schedule</h2>
          <div className="text-sm text-gray-400 mt-1">
            {schedule.total_games} games across {weeks.length} weeks
          </div>
        </div>
        <button onClick={onRefresh} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {weeks.map((week) => (
          <div key={week} className="bg-black bg-opacity-30 rounded-lg p-4">
            <h3 className="text-lg font-bold text-accent mb-4">Week {week}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedule.schedule_by_week[week].map((game) => (
                <div key={game.game_id} className="bg-gunmetal border border-gray-700 rounded-lg p-3">
                  {/* Header row */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-white">{game.team1_name} vs {game.team2_name}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })} at {game.time}
                      </div>
                    </div>
                    {statusBadge(game.status)}
                  </div>

                  {/* Completed score display */}
                  {game.status === 'completed' && game.team1_score != null && game.team2_score != null && (
                    <div className="text-sm font-semibold text-white bg-black/20 rounded px-2 py-1 mb-2 text-center">
                      {game.team1_name} {game.team1_score} — {game.team2_score} {game.team2_name}
                    </div>
                  )}

                  {/* Score entry inline form */}
                  {scoringGameId === game.game_id ? (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">{game.team1_name}</label>
                          <input
                            type="number" min="0"
                            value={scoreInputs.team1}
                            onChange={(e) => setScoreInputs({ ...scoreInputs, team1: e.target.value })}
                            className="w-full px-2 py-1 bg-black/40 border border-gray-600 rounded text-white text-center"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">{game.team2_name}</label>
                          <input
                            type="number" min="0"
                            value={scoreInputs.team2}
                            onChange={(e) => setScoreInputs({ ...scoreInputs, team2: e.target.value })}
                            className="w-full px-2 py-1 bg-black/40 border border-gray-600 rounded text-white text-center"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveScore(game.game_id)}
                          disabled={saving}
                          className="flex-1 px-3 py-1 bg-green-700 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save Score'}
                        </button>
                        <button
                          onClick={() => setScoringGameId(null)}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : editingGameId === game.game_id ? (
                    /* Edit date/time inline form */
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Date</label>
                          <input
                            type="date"
                            value={editInputs.game_date}
                            onChange={(e) => setEditInputs({ ...editInputs, game_date: e.target.value })}
                            className="w-full px-2 py-1 bg-black/40 border border-gray-600 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Time</label>
                          <input
                            type="time"
                            value={editInputs.game_time}
                            onChange={(e) => setEditInputs({ ...editInputs, game_time: e.target.value })}
                            className="w-full px-2 py-1 bg-black/40 border border-gray-600 rounded text-white text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(game.game_id)}
                          disabled={saving}
                          className="flex-1 px-3 py-1 bg-accent text-white text-sm rounded hover:bg-accent-dark disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setEditingGameId(null)}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Action buttons */
                    game.status !== 'cancelled' && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {game.status !== 'completed' && (
                          <button
                            onClick={() => startScoring(game)}
                            className="px-3 py-1 bg-green-800 text-green-100 text-xs rounded hover:bg-green-700"
                          >
                            Record Score
                          </button>
                        )}
                        {game.status === 'completed' && (
                          <button
                            onClick={() => startScoring(game)}
                            className="px-3 py-1 bg-yellow-800 text-yellow-100 text-xs rounded hover:bg-yellow-700"
                          >
                            Edit Score
                          </button>
                        )}
                        <button
                          onClick={() => startEditing(game)}
                          className="px-3 py-1 bg-gray-600 text-gray-100 text-xs rounded hover:bg-gray-500"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelGame(game.game_id)}
                          disabled={saving}
                          className="px-3 py-1 bg-red-900 text-red-200 text-xs rounded hover:bg-red-800 disabled:opacity-50"
                        >
                          Cancel Game
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

