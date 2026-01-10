import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import { League, LeagueCreateRequest, LeagueUpdateRequest, AdminConfig, AdminConfigCreateRequest, User, PaginatedUserResponse, Field, FieldCreateRequest, FieldUpdateRequest } from '../services';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import { AdminManagementModal, LeagueFormModal, FieldManagementModal } from './admin/components';

type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
type GameFormat = '7v7' | '6v6' | '5v5';

export default function AdminPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { request: authenticatedRequest } = useAuthenticatedApi();
  
  const [leagues, setLeagues] = useState<League[]>([]);
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

  // User management state
  const [usersData, setUsersData] = useState<PaginatedUserResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(25);
  
  // Global field management state (fields are independent of leagues)
  const [fields, setFields] = useState<Field[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [fieldFormData, setFieldFormData] = useState<Partial<FieldCreateRequest>>({
    name: '',
    field_number: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    facility_name: '',
    additional_notes: '',
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
    console.log('[AdminPage useEffect] Loading data for admin user');
    loadLeagues();
    loadAdmins();
    loadUsers(1);
    // Load fields - authenticatedRequest should handle auth
    loadAllFields();
  }, [isSignedIn, user, navigate]);



  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaguesData = await authenticatedRequest<League[]>('/admin/leagues');
      setLeagues(leaguesData);
    } catch (err) {
      console.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please check your authentication and try again.');
    } finally {
      setIsLoading(false);
    }
  };



  const loadAdmins = async () => {
    try {
      const adminsData = await authenticatedRequest<AdminConfig[]>('/admin/admins');
      setAdmins(adminsData);
    } catch (err) {
      console.error('Failed to load admins:', err);
    }
  };

  const loadUsers = async (page: number = 1) => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const response = await authenticatedRequest<PaginatedUserResponse>(`/admin/users?page=${page}&page_size=${usersPageSize}`);
      setUsersData(response);
      setUsersPage(page);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminFormData.email) {
      setError('Email is required');
      return;
    }

    try {
      await authenticatedRequest<AdminConfig>('/admin/admins', {
        method: 'POST',
        body: JSON.stringify(adminFormData as AdminConfigCreateRequest),
      });
      
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
      await authenticatedRequest<any>(`/admin/admins/${email}`, {
        method: 'DELETE',
      });
      
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
      const response = await authenticatedRequest<League>('/admin/leagues', {
        method: 'POST',
        body: JSON.stringify(formData as LeagueCreateRequest),
      });
      
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
      await authenticatedRequest<League>(`/admin/leagues/${editingLeague.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData as LeagueUpdateRequest),
      });
      
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
      await authenticatedRequest<any>(`/admin/leagues/${leagueId}`, {
        method: 'DELETE',
      });
      
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
    
    setFormData((prev: Partial<LeagueCreateRequest>) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Global field management functions (fields are independent of leagues)
  const loadAllFields = async () => {
    try {
      const fieldsData = await authenticatedRequest<Field[]>(`/admin/fields`);
      setFields(Array.isArray(fieldsData) ? fieldsData : []);
      // Clear any previous errors on success
      setError(null);
    } catch (err: any) {
      console.error('Failed to load fields:', err);
      // Only show error for actual failures, not auth issues
      if (err.response?.status && err.response.status !== 401 && err.response.status !== 403) {
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load fields. Please try again.';
        setError(errorMessage);
      }
      // Set empty array on error to prevent UI issues
      setFields([]);
    }
  };

  const openFieldModal = () => {
    setShowFieldModal(true);
  };

  const handleCreateField = async () => {
    if (!fieldFormData.name || !fieldFormData.street_address || !fieldFormData.city || !fieldFormData.state || !fieldFormData.zip_code) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authenticatedRequest<Field>(`/admin/fields`, {
        method: 'POST',
        body: JSON.stringify(fieldFormData as FieldCreateRequest),
      });
      
      setSuccess('Field created successfully!');
      resetFieldForm();
      await loadAllFields();
    } catch (err: any) {
      console.error('Failed to create field:', err);
      let errorMessage = 'Failed to create field. Please try again.';
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

  const handleUpdateField = async () => {
    if (!editingField) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authenticatedRequest<Field>(`/admin/fields/${editingField.id}`, {
        method: 'PUT',
        body: JSON.stringify(fieldFormData as FieldUpdateRequest),
      });
      
      setSuccess('Field updated successfully!');
      resetFieldForm();
      setEditingField(null);
      await loadAllFields();
    } catch (err: any) {
      console.error('Failed to update field:', err);
      let errorMessage = 'Failed to update field. Please try again.';
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

  const handleDeleteField = async (fieldId: number) => {
    if (!window.confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await authenticatedRequest<void>(`/admin/fields/${fieldId}`, {
        method: 'DELETE',
      });
      
      setSuccess('Field deleted successfully!');
      await loadAllFields();
    } catch (err: any) {
      console.error('Failed to delete field:', err);
      let errorMessage = 'Failed to delete field. Please try again.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    }
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setFieldFormData({
      name: field.name,
      field_number: field.field_number || '',
      street_address: field.street_address,
      city: field.city,
      state: field.state,
      zip_code: field.zip_code,
      country: field.country,
      facility_name: field.facility_name || '',
      additional_notes: field.additional_notes || '',
    });
  };

  const handleFieldInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFieldFormData((prev: Partial<FieldCreateRequest>) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFieldForm = () => {
    setFieldFormData({
      name: '',
      field_number: '',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'USA',
      facility_name: '',
      additional_notes: '',
    });
    setEditingField(null);
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
          <h1 className="text-3xl font-bold text-accent mb-2">Admin Dashboard</h1>
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
          <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-4">
            <h3 className="text-lg font-bold text-accent">Total Leagues</h3>
            <p className="text-2xl font-bold text-white">{leagues.length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-4">
            <h3 className="text-lg font-bold text-accent">Active Leagues</h3>
            <p className="text-2xl font-bold text-white">{leagues.filter(l => l.is_active).length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-4">
            <h3 className="text-lg font-bold text-accent">Total Admins</h3>
            <p className="text-2xl font-bold text-white">{admins.length}</p>
          </div>
          <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-4">
            <h3 className="text-lg font-bold text-accent">Current User</h3>
            <p className="text-sm text-white">{user?.emailAddresses?.[0]?.emailAddress}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-accent text-white font-bold rounded-lg hover:bg-accent-dark transition-colors"
          >
            ➕ Create League
          </button>
          <button
            onClick={() => setShowAdminModal(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔑 Manage Admins
          </button>
          <button
            onClick={loadLeagues}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            🔄 Refresh Data
          </button>
        </div>

        {/* Users List */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-accent mb-6">
            Users {usersData && usersData.total > 0 && `(${usersData.total})`}
          </h2>
          
          {isLoadingUsers ? (
            <div className="text-center py-8">
              <div className="text-accent text-xl">Loading users...</div>
            </div>
          ) : usersData && usersData.users.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-xl">No users found.</div>
            </div>
          ) : usersData ? (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left p-3 text-accent font-semibold">Name</th>
                      <th className="text-left p-3 text-accent font-semibold">Email</th>
                      <th className="text-left p-3 text-accent font-semibold">Phone</th>
                      <th className="text-left p-3 text-accent font-semibold">Gender</th>
                      <th className="text-left p-3 text-accent font-semibold">Status</th>
                      <th className="text-left p-3 text-accent font-semibold">Leagues</th>
                      <th className="text-left p-3 text-accent font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((user) => (
                      <tr key={user.clerk_user_id} className="border-b border-gray-700 hover:bg-black hover:bg-opacity-30">
                        <td className="p-3 text-white">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="p-3 text-gray-300">{user.email}</td>
                        <td className="p-3 text-gray-300">{user.phone || '-'}</td>
                        <td className="p-3 text-gray-300">{user.gender || '-'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.registration_status === 'registered' ? 'bg-green-900 text-green-200' :
                            user.registration_status === 'active' ? 'bg-blue-900 text-blue-200' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {user.registration_status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-300">{user.leagues_count}</td>
                        <td className="p-3 text-gray-300">
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {usersData.total_pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-600 pt-4">
                  <div className="text-sm text-gray-300">
                    Showing {usersData.total > 0 ? (usersPage - 1) * usersPageSize + 1 : 0} to {Math.min(usersPage * usersPageSize, usersData.total)} of {usersData.total} users
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newPage = usersPage - 1;
                        if (newPage >= 1) {
                          setUsersPage(newPage);
                          loadUsers(newPage);
                        }
                      }}
                      disabled={usersPage === 1}
                      className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    
                    <div className="flex gap-1">
                      {(() => {
                        const pages: (number | string)[] = [];
                        const maxPagesToShow = 7;
                        const totalPages = usersData.total_pages;
                        
                        if (totalPages <= maxPagesToShow) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          if (usersPage <= 4) {
                            for (let i = 1; i <= 5; i++) {
                              pages.push(i);
                            }
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (usersPage >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            pages.push(1);
                            pages.push('...');
                            for (let i = usersPage - 1; i <= usersPage + 1; i++) {
                              pages.push(i);
                            }
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, index) => (
                          page === '...' ? (
                            <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-400">
                              ...
                            </span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => {
                                if (typeof page === 'number') {
                                  setUsersPage(page);
                                  loadUsers(page);
                                }
                              }}
                              className={`px-3 py-1 rounded transition-colors ${
                                usersPage === page
                                  ? 'bg-accent text-white font-bold'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        ));
                      })()}
                    </div>
                    
                    <button
                      onClick={() => {
                        const newPage = usersPage + 1;
                        if (newPage <= usersData.total_pages) {
                          setUsersPage(newPage);
                          loadUsers(newPage);
                        }
                      }}
                      disabled={usersPage === usersData.total_pages}
                      className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Fields List */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-accent">Fields ({fields.length})</h2>
            <button
              onClick={openFieldModal}
              className="px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors"
            >
              ➕ Add Field
            </button>
          </div>
          
          {fields.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-xl mb-4">No fields configured yet</div>
              <button
                onClick={openFieldModal}
                className="px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors"
              >
                Add Your First Field
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Leagues List */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-accent rounded-xl p-6">
          <h2 className="text-2xl font-bold text-accent mb-6">Leagues</h2>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-accent text-xl">Loading leagues...</div>
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-xl mb-4">No leagues found</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors"
              >
                Create Your First League
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {leagues.map((league) => (
                <div key={league.id} className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-accent">{league.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/admin/leagues/${league.id}`)}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                      >
                        Manage League
                      </button>
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
            onInputChange={(e) => setAdminFormData((prev: Partial<AdminConfigCreateRequest>) => ({ ...prev, [e.target.name]: e.target.value }))}
            onSubmit={handleAddAdmin}
            onRemove={handleRemoveAdmin}
            onCancel={() => {
              setShowAdminModal(false);
              setAdminFormData({ email: '', role: 'admin' });
            }}
            isLoading={isLoading}
          />
        )}

        {showFieldModal && (
          <FieldManagementModal
            league={null}
            fields={fields}
            formData={fieldFormData}
            editingField={editingField}
            onInputChange={handleFieldInputChange}
            onSubmit={editingField ? handleUpdateField : handleCreateField}
            onEdit={handleEditField}
            onDelete={handleDeleteField}
            onCancelEdit={() => {
              resetFieldForm();
            }}
            onCancel={() => {
              setShowFieldModal(false);
              resetFieldForm();
            }}
            isLoading={isLoading}
          />
        )}
      </div>
    </BaseLayout>
  );
}
