import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import apiService, { League, LeagueCreateRequest, LeagueUpdateRequest, LeagueStats, AdminConfig, AdminConfigCreateRequest, AdminConfigUpdateRequest } from '../services/api';

type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
type GameFormat = '7v7' | '5v5' | '4v4' | '3v3';

export default function AdminPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  
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

  // Check admin access on component mount
  useEffect(() => {
    if (!isSignedIn) {
      navigate('/');
      return;
    }

    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    const adminEmail = 'alexcarria1@gmail.com';
    
    if (userEmail !== adminEmail) {
      navigate('/');
      return;
    }

    // Load data if user is admin
    loadLeagues();
    loadAdmins();
  }, [isSignedIn, user, navigate]);

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
      console.log('Loading leagues...');
      const leaguesData = await apiService.getAllLeagues();
      console.log('Leagues loaded:', leaguesData);
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please check your authentication and try again.');
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

    try {
      await apiService.addAdminEmail(adminFormData as AdminConfigCreateRequest);
      setSuccess('Admin added successfully!');
      setAdminFormData({ email: '', role: 'admin' });
      setShowAdminModal(false);
      loadAdmins();
    } catch (err) {
      console.error('Failed to add admin:', err);
      setError('Failed to add admin. Please try again.');
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email === 'alexcarria1@gmail.com') {
      setError('Cannot remove the primary admin');
      return;
    }

    try {
      await apiService.removeAdminEmail(email);
      setSuccess('Admin removed successfully!');
      loadAdmins();
    } catch (err) {
      console.error('Failed to remove admin:', err);
      setError('Failed to remove admin. Please try again.');
    }
  };

  const handleCreateLeague = async () => {
    if (!formData.name || !formData.start_date || !formData.num_weeks) {
      setError('Name, start date, and number of weeks are required');
      return;
    }

    try {
      await apiService.createLeague(formData as LeagueCreateRequest);
      setSuccess('League created successfully!');
      setShowCreateModal(false);
      resetForm();
      loadLeagues();
    } catch (err) {
      console.error('Failed to create league:', err);
      setError('Failed to create league. Please try again.');
    }
  };

  const handleUpdateLeague = async () => {
    if (!editingLeague) return;

    try {
      await apiService.updateLeague(editingLeague.id, formData as LeagueUpdateRequest);
      setSuccess('League updated successfully!');
      setShowEditModal(false);
      setEditingLeague(null);
      resetForm();
      loadLeagues();
    } catch (err) {
      console.error('Failed to update league:', err);
      setError('Failed to update league. Please try again.');
    }
  };

  const handleDeleteLeague = async (leagueId: number) => {
    if (!window.confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteLeague(leagueId);
      setSuccess('League deleted successfully!');
      loadLeagues();
    } catch (err) {
      console.error('Failed to delete league:', err);
      setError('Failed to delete league. Please try again.');
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
      registration_fee: league.registration_fee || undefined,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  if (!isSignedIn) {
    return null;
  }

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pumpkin mb-2">Admin Dashboard</h1>
          <p className="text-gray-300">Manage leagues, teams, and admin users</p>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-4">
            <h3 className="text-lg font-bold text-pumpkin">Total Leagues</h3>
            <p className="text-2xl font-bold text-white">{leagues.length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-4">
            <h3 className="text-lg font-bold text-pumpkin">Active Leagues</h3>
            <p className="text-2xl font-bold text-white">{leagues.filter(l => l.is_active).length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-4">
            <h3 className="text-lg font-bold text-pumpkin">Total Admins</h3>
            <p className="text-2xl font-bold text-white">{admins.length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-4">
            <h3 className="text-lg font-bold text-pumpkin">Current User</h3>
            <p className="text-sm text-white">{user?.emailAddresses?.[0]?.emailAddress}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-pumpkin text-black font-bold rounded-lg hover:bg-deeporange transition-colors"
          >
            ➕ Create League
          </button>
          <button
            onClick={() => setShowAdminModal(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            👥 Manage Admins
          </button>
          <button
            onClick={loadLeagues}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            🔄 Refresh Data
          </button>
        </div>

        {/* Leagues List */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
          <h2 className="text-2xl font-bold text-pumpkin mb-6">Leagues</h2>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-pumpkin text-xl">Loading leagues...</div>
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-xl mb-4">No leagues found</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors"
              >
                Create Your First League
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {leagues.map((league) => (
                <div key={league.id} className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-pumpkin">{league.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(league)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLeague(league.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Format:</span> {league.format}
                    </div>
                    <div>
                      <span className="text-gray-400">Tournament:</span> {league.tournament_format}
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span> 
                      <span className={`ml-1 ${league.is_active ? 'text-green-400' : 'text-red-400'}`}>
                        {league.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
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

        {showEditModal && (
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
    </BaseLayout>
  );
}

// Modal Components
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-pumpkin">Manage Admin Users</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Current Admins */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-pumpkin mb-3">Current Admins</h4>
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between bg-black bg-opacity-30 rounded p-3">
                <div>
                  <div className="font-semibold text-white">{admin.email}</div>
                  <div className="text-sm text-gray-400">Role: {admin.role}</div>
                </div>
                <button
                  onClick={() => onRemove(admin.email)}
                  disabled={admin.email === 'alexcarria1@gmail.com'}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Admin */}
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-lg font-bold text-pumpkin mb-3">Add New Admin</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSubmit}
              disabled={isLoading || !formData.email}
              className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50"
            >
              Add Admin
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border-2 border-pumpkin text-pumpkin font-bold rounded hover:bg-pumpkin hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-pumpkin">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">League Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onInputChange}
              rows={3}
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
            />
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Format *</label>
              <select
                name="format"
                value={formData.format}
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Number of Weeks *</label>
              <input
                type="number"
                name="num_weeks"
                value={formData.num_weeks}
                onChange={onInputChange}
                min="1"
                required
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Game Duration (minutes)</label>
              <input
                type="number"
                name="game_duration"
                value={formData.game_duration}
                onChange={onInputChange}
                min="30"
                max="120"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          </div>

          {/* Tournament Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tournament Format *</label>
            <select
              name="tournament_format"
              value={formData.tournament_format}
              onChange={onInputChange}
              required
              className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
            >
              <option value="round_robin">Round Robin</option>
              <option value="swiss">Swiss Tournament</option>
              <option value="playoff_bracket">Playoff Bracket</option>
              <option value="compass_draw">Compass Draw</option>
            </select>
            <p className="text-sm text-gray-400 mt-1">
              {getTournamentFormatDescription(formData.tournament_format as TournamentFormat)}
            </p>
          </div>

          {/* Team Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Teams</label>
              <input
                type="number"
                name="min_teams"
                value={formData.min_teams}
                onChange={onInputChange}
                min="2"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Maximum Teams</label>
              <input
                type="number"
                name="max_teams"
                value={formData.max_teams || ''}
                onChange={onInputChange}
                min="1"
                className="w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin"
              />
            </div>
          </div>

          {/* Registration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Registration Deadline</label>
              <input
                type="date"
                name="registration_deadline"
                value={formData.registration_deadline}
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
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save League'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border-2 border-pumpkin text-pumpkin font-bold rounded hover:bg-pumpkin hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 