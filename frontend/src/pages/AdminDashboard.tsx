import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import apiService, { League, LeagueCreateRequest, LeagueUpdateRequest, LeagueStats, AdminConfig, AdminConfigCreateRequest, AdminConfigUpdateRequest } from '../services/api';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
type GameFormat = '7v7' | '5v5' | '4v4' | '3v3';

export default function AdminDashboard({ isOpen, onClose }: AdminDashboardProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // League creation/editing state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  
  // Admin management state
  const [admins, setAdmins] = useState<AdminConfig[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminFormData, setAdminFormData] = useState<Partial<AdminConfigCreateRequest>>({
    email: '',
    role: 'admin'
  });
  
  // Form state for league creation/editing
  const [formData, setFormData] = useState<Partial<LeagueCreateRequest>>({
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

  // Load leagues and admins on component mount
  useEffect(() => {
    if (isOpen && isSignedIn) {
      loadLeagues();
      loadAdmins();
    }
  }, [isOpen, isSignedIn]);

  // Load league stats when a league is selected
  useEffect(() => {
    if (selectedLeague) {
      loadLeagueStats(selectedLeague.id);
    }
  }, [selectedLeague]);

  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaguesData = await apiService.getAllLeagues();
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeagueStats = async (leagueId: number) => {
    try {
      const stats = await apiService.getLeagueStats(leagueId);
      setLeagueStats(stats);
    } catch (err) {
      console.error('Failed to load league stats:', err);
    }
  };

  const loadAdmins = async () => {
    try {
      const adminsData = await apiService.getAdminConfigs();
      setAdmins(adminsData);
    } catch (err) {
      console.error('Failed to load admins:', err);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminFormData.email) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newAdmin = await apiService.addAdminEmail(adminFormData as AdminConfigCreateRequest);
      setAdmins(prev => [...prev, newAdmin]);
      setShowAdminModal(false);
      setSuccess('Admin added successfully!');
      setAdminFormData({ email: '', role: 'admin' });
    } catch (err) {
      console.error('Failed to add admin:', err);
      setError('Failed to add admin. Please check the email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Are you sure you want to remove admin privileges from ${email}?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await apiService.removeAdminEmail(email);
      setAdmins(prev => prev.filter(admin => admin.email !== email));
      setSuccess('Admin removed successfully!');
    } catch (err) {
      console.error('Failed to remove admin:', err);
      setError('Failed to remove admin. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLeague = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newLeague = await apiService.createLeague(formData as LeagueCreateRequest);
      setLeagues(prev => [newLeague, ...prev]);
      setShowCreateModal(false);
      setSuccess('League created successfully!');
      resetForm();
    } catch (err) {
      console.error('Failed to create league:', err);
      setError('Failed to create league. Please check your inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLeague = async () => {
    if (!editingLeague) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const updatedLeague = await apiService.updateLeague(editingLeague.id, formData as LeagueUpdateRequest);
      setLeagues(prev => prev.map(l => l.id === updatedLeague.id ? updatedLeague : l));
      setShowEditModal(false);
      setEditingLeague(null);
      setSuccess('League updated successfully!');
      resetForm();
    } catch (err) {
      console.error('Failed to update league:', err);
      setError('Failed to update league. Please check your inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLeague = async (leagueId: number) => {
    if (!confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      await apiService.deleteLeague(leagueId);
      setLeagues(prev => prev.filter(l => l.id !== leagueId));
      if (selectedLeague?.id === leagueId) {
        setSelectedLeague(null);
        setLeagueStats(null);
      }
      setSuccess('League deleted successfully!');
    } catch (err) {
      console.error('Failed to delete league:', err);
      setError('Failed to delete league. It may have registered players.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
  };

  const openEditModal = (league: League) => {
    setEditingLeague(league);
    setFormData({
      name: league.name,
      description: league.description,
      start_date: league.start_date,
      num_weeks: league.num_weeks,
      format: league.format as GameFormat,
      tournament_format: league.tournament_format as TournamentFormat,
      game_duration: league.game_duration,
      games_per_week: league.games_per_week,
      min_teams: league.min_teams,
      max_teams: league.max_teams,
      registration_deadline: league.registration_deadline,
      registration_fee: league.registration_fee,
      regular_season_weeks: league.regular_season_weeks,
      playoff_weeks: league.playoff_weeks,
      swiss_rounds: league.swiss_rounds,
      swiss_pairing_method: league.swiss_pairing_method,
      compass_draw_rounds: league.compass_draw_rounds,
      playoff_teams: league.playoff_teams,
      playoff_format: league.playoff_format,
    });
    setShowEditModal(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? (value === '' ? undefined : parseInt(value)) :
              value === '' ? undefined : value
    }));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto relative">
        <button
          className="absolute top-2 right-2 text-pumpkin hover:text-deeporange text-2xl font-bold"
          onClick={onClose}
          aria-label="Close admin dashboard"
        >
          ×
        </button>
        
        <h2 className="text-3xl font-bold text-pumpkin mb-6 text-center">Admin Dashboard</h2>
        
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-3 bg-green-900 border border-green-500 text-green-200 rounded">
            {success}
            <button onClick={() => setSuccess(null)} className="float-right text-green-300 hover:text-white">×</button>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 text-red-200 rounded">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-white">×</button>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">League Management</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors"
            >
              Manage Admins
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors"
            >
              Create New League
            </button>
          </div>
        </div>

        {/* Leagues List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leagues List */}
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-4">All Leagues</h4>
            {isLoading ? (
              <div className="text-center text-gray-300">Loading leagues...</div>
            ) : leagues.length === 0 ? (
              <div className="text-center text-gray-300">No leagues found. Create your first league!</div>
            ) : (
              <div className="space-y-3">
                {leagues.map(league => (
                  <div
                    key={league.id}
                    className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                      selectedLeague?.id === league.id
                        ? 'border-pumpkin bg-pumpkin bg-opacity-20'
                        : 'border-gray-600 hover:border-pumpkin'
                    }`}
                    onClick={() => setSelectedLeague(league)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-semibold text-white">{league.name}</h5>
                        <p className="text-sm text-gray-300">
                          {league.tournament_format} • {league.format} • {league.num_weeks} weeks
                        </p>
                        <p className="text-xs text-gray-400">
                          {league.registered_players_count} players • {league.registered_teams_count} teams
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(league);
                          }}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLeague(league.id);
                          }}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* League Details */}
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-4">League Details</h4>
            {selectedLeague ? (
              <div className="space-y-4">
                <div>
                  <h5 className="font-bold text-white text-lg">{selectedLeague.name}</h5>
                  {selectedLeague.description && (
                    <p className="text-gray-300 text-sm">{selectedLeague.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-pumpkin font-semibold">Format:</span>
                    <span className="text-white ml-2">{selectedLeague.format}</span>
                  </div>
                  <div>
                    <span className="text-pumpkin font-semibold">Tournament:</span>
                    <span className="text-white ml-2">{selectedLeague.tournament_format}</span>
                  </div>
                  <div>
                    <span className="text-pumpkin font-semibold">Start Date:</span>
                    <span className="text-white ml-2">{new Date(selectedLeague.start_date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-pumpkin font-semibold">Duration:</span>
                    <span className="text-white ml-2">{selectedLeague.num_weeks} weeks</span>
                  </div>
                  <div>
                    <span className="text-pumpkin font-semibold">Players:</span>
                    <span className="text-white ml-2">{selectedLeague.registered_players_count}</span>
                  </div>
                  <div>
                    <span className="text-pumpkin font-semibold">Teams:</span>
                    <span className="text-white ml-2">{selectedLeague.registered_teams_count}</span>
                  </div>
                </div>

                {leagueStats && (
                  <div className="mt-4 p-3 bg-gray-800 rounded">
                    <h6 className="font-semibold text-pumpkin mb-2">Statistics</h6>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-300">Status:</span>
                        <span className={`ml-2 font-semibold ${
                          leagueStats.registration_status === 'open' ? 'text-green-400' :
                          leagueStats.registration_status === 'closed' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {leagueStats.registration_status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-300">Days to Start:</span>
                        <span className="text-white ml-2">{leagueStats.days_until_start}</span>
                      </div>
                      {leagueStats.days_until_deadline && (
                        <div>
                          <span className="text-gray-300">Days to Deadline:</span>
                          <span className="text-white ml-2">{leagueStats.days_until_deadline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-300">
                Select a league to view details
              </div>
            )}
          </div>
        </div>

        {/* Create League Modal */}
        {showCreateModal && (
          <LeagueFormModal
            title="Create New League"
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleCreateLeague}
            onCancel={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            isLoading={isLoading}
            getTournamentFormatDescription={getTournamentFormatDescription}
          />
        )}

        {/* Edit League Modal */}
        {showEditModal && editingLeague && (
          <LeagueFormModal
            title="Edit League"
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleUpdateLeague}
            onCancel={() => {
              setShowEditModal(false);
              setEditingLeague(null);
              resetForm();
            }}
            isLoading={isLoading}
            getTournamentFormatDescription={getTournamentFormatDescription}
          />
        )}

        {/* Admin Management Modal */}
        {showAdminModal && (
          <AdminManagementModal
            admins={admins}
            formData={adminFormData}
            onInputChange={(e) => setAdminFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))}
            onSubmit={handleAddAdmin}
            onRemove={handleRemoveAdmin}
            onCancel={() => {
              setShowAdminModal(false);
              setAdminFormData({ email: '', role: 'admin' });
            }}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

// Admin Management Modal Component
interface AdminManagementModalProps {
  admins: AdminConfig[];
  formData: Partial<AdminConfigCreateRequest>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  onRemove: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AdminManagementModal({
  admins,
  formData,
  onInputChange,
  onSubmit,
  onRemove,
  onCancel,
  isLoading
}: AdminManagementModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-pumpkin mb-6">Manage Admin Access</h3>
        
        {/* Current Admins */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">Current Admins ({admins.length})</h4>
          {admins.length === 0 ? (
            <p className="text-gray-300">No admins configured yet.</p>
          ) : (
            <div className="space-y-2">
              {admins.map(admin => (
                <div key={admin.id} className="flex justify-between items-center p-3 bg-black bg-opacity-30 rounded border border-gray-600">
                  <div>
                    <span className="text-white font-medium">{admin.email}</span>
                    <span className="text-gray-400 ml-2">({admin.role})</span>
                  </div>
                  <button
                    onClick={() => onRemove(admin.email)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Admin */}
        <div className="border-t border-gray-600 pt-6">
          <h4 className="text-lg font-semibold text-white mb-3">Add New Admin</h4>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={onInputChange}
                  required
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                  placeholder="admin@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  name="role"
                  value={formData.role || 'admin'}
                  onChange={onInputChange}
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 border border-pumpkin text-pumpkin rounded hover:bg-pumpkin hover:text-black transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// League Form Modal Component
interface LeagueFormModalProps {
  title: string;
  formData: Partial<LeagueCreateRequest>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  getTournamentFormatDescription: (format: TournamentFormat) => string;
}

function LeagueFormModal({
  title,
  formData,
  onInputChange,
  onSubmit,
  onCancel,
  isLoading,
  getTournamentFormatDescription
}: LeagueFormModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-pumpkin mb-6">{title}</h3>
        
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">League Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Format *</label>
              <select
                name="format"
                value={formData.format || '7v7'}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              >
                <option value="7v7">7v7</option>
                <option value="5v5">5v5</option>
                <option value="4v4">4v4</option>
                <option value="3v3">3v3</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={onInputChange}
              rows={3}
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              placeholder="Optional description of the league..."
            />
          </div>

          {/* Tournament Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tournament Format *</label>
            <select
              name="tournament_format"
              value={formData.tournament_format || 'round_robin'}
              onChange={onInputChange}
              required
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
            >
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss Tournament</option>
              <option value="playoff_bracket">Playoff Bracket</option>
              <option value="compass_draw">Compass Draw</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {getTournamentFormatDescription((formData.tournament_format as TournamentFormat) || 'round_robin')}
            </p>
          </div>

          {/* Tournament Format Specific Settings */}
          {(formData.tournament_format === 'swiss') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Swiss Rounds *</label>
                <input
                  type="number"
                  name="swiss_rounds"
                  value={formData.swiss_rounds || ''}
                  onChange={onInputChange}
                  min="1"
                  max="10"
                  required
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pairing Method</label>
                <select
                  name="swiss_pairing_method"
                  value={formData.swiss_pairing_method || 'buchholz'}
                  onChange={onInputChange}
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                >
                  <option value="buchholz">Buchholz</option>
                  <option value="sonneborn_berger">Sonneborn-Berger</option>
                </select>
              </div>
            </div>
          )}

          {(formData.tournament_format === 'playoff_bracket') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Regular Season Weeks *</label>
                <input
                  type="number"
                  name="regular_season_weeks"
                  value={formData.regular_season_weeks || ''}
                  onChange={onInputChange}
                  min="1"
                  required
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Playoff Weeks *</label>
                <input
                  type="number"
                  name="playoff_weeks"
                  value={formData.playoff_weeks || ''}
                  onChange={onInputChange}
                  min="1"
                  required
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Playoff Teams</label>
                <input
                  type="number"
                  name="playoff_teams"
                  value={formData.playoff_teams || ''}
                  onChange={onInputChange}
                  min="2"
                  className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                />
              </div>
            </div>
          )}

          {(formData.tournament_format === 'compass_draw') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Compass Draw Rounds *</label>
              <input
                type="number"
                name="compass_draw_rounds"
                value={formData.compass_draw_rounds || ''}
                onChange={onInputChange}
                min="1"
                max="10"
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          )}

          {/* Schedule Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date || ''}
                onChange={onInputChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Total Weeks *</label>
              <input
                type="number"
                name="num_weeks"
                value={formData.num_weeks || ''}
                onChange={onInputChange}
                min="1"
                max="20"
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Games Per Week</label>
              <input
                type="number"
                name="games_per_week"
                value={formData.games_per_week || ''}
                onChange={onInputChange}
                min="1"
                max="3"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          </div>

          {/* Team Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Min Teams *</label>
              <input
                type="number"
                name="min_teams"
                value={formData.min_teams || ''}
                onChange={onInputChange}
                min="2"
                max="20"
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Teams</label>
              <input
                type="number"
                name="max_teams"
                value={formData.max_teams || ''}
                onChange={onInputChange}
                min="1"
                max="50"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Duration (min)</label>
              <input
                type="number"
                name="game_duration"
                value={formData.game_duration || ''}
                onChange={onInputChange}
                min="30"
                max="120"
                step="15"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          </div>

          {/* Registration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Registration Deadline</label>
              <input
                type="date"
                name="registration_deadline"
                value={formData.registration_deadline || ''}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Registration Fee (cents)</label>
              <input
                type="number"
                name="registration_fee"
                value={formData.registration_fee || ''}
                onChange={onInputChange}
                min="0"
                step="100"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="0 = free"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-pumpkin text-pumpkin rounded hover:bg-pumpkin hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 