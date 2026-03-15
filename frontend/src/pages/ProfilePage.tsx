import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import { getEmailError, getPhoneError } from '../utils/validation';
import { apiService, UserProfile } from '../services';
import { invitationService } from '../services/public/invitations';
import { MyGroup } from '../services/core/types';

export default function ProfilePage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  type EmailErrorType = string | { message: string; suggestion: string };
  const [fieldErrors, setFieldErrors] = useState<{
    email?: EmailErrorType;
    phone?: string;
    [key: string]: string | EmailErrorType | undefined;
  }>({});

  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Fetch user profile from API
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          setIsLoading(true);
          setError('');

          // Try to fetch existing profile from API
          const existingProfile = await apiService.getUserProfile(user.id);

          if (existingProfile) {
            setProfile(existingProfile);
            setOriginalProfile(existingProfile);
          } else {
            // Create default profile from Clerk user data
            const defaultProfile: UserProfile = {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.primaryEmailAddress?.emailAddress || '',
              phone: '',
              dateOfBirth: '',
              gender: '',
              communicationsAccepted: false,
              registrationStatus: 'not_registered'
            };
            setProfile(defaultProfile);
            setOriginalProfile(defaultProfile);
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          setError('Failed to load profile. Please try again.');

          // Fallback to default profile
          const defaultProfile: UserProfile = {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.primaryEmailAddress?.emailAddress || '',
            phone: '',
            dateOfBirth: '',
            gender: '',
            communicationsAccepted: false,
            registrationStatus: 'not_registered'
          };
          setProfile(defaultProfile);
          setOriginalProfile(defaultProfile);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch my groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (!user) return;
      setGroupsLoading(true);
      try {
        const token = await getToken();
        if (token) {
          const groups = await invitationService.getMyGroups(token);
          setMyGroups(groups);
        }
      } catch {
        // Non-fatal — silently ignore
      } finally {
        setGroupsLoading(false);
      }
    };
    fetchGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setProfile((prev: UserProfile | null) => prev ? {
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    } : null);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    setError('');
    setSuccess('');
    setFieldErrors({});

    // Validate email and phone
    const errors: { 
      email?: EmailErrorType; 
      phone?: string; 
      [key: string]: string | EmailErrorType | undefined; 
    } = {};
    const emailError = getEmailError(profile.email);
    if (emailError) errors.email = emailError;
    const phoneError = getPhoneError(profile.phone);
    if (phoneError) errors.phone = phoneError;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the errors above.');
      setIsSaving(false);
      return;
    }

    try {
      const updatedProfile = await apiService.updateUserProfile(user.id, profile);
      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      // Extract error message from the response
      let errorMessage = 'Failed to save profile. Please try again.';
      if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original profile data that was fetched from the API
    if (originalProfile) {
      setProfile({ ...originalProfile });
    }
    setIsEditing(false);
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await invitationService.revokeInvitation(invitationId, token);
      // Refresh groups
      const groups = await invitationService.getMyGroups(token);
      setMyGroups(groups);
      setSuccess('Invitation revoked.');
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke invitation.');
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const inputDisabledCls = 'w-full px-3 py-2 bg-[#1A1A1A] border border-white/5 text-[#A0A0A0] text-sm rounded-md outline-none cursor-default';
  const labelCls = 'block text-xs font-medium text-[#A0A0A0] mb-1';

  if (isLoading) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="inline-flex items-center gap-2 text-[#6B6B6B] text-sm">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            Loading profile...
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (!profile) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-sm text-[#A0A0A0] mb-3">Profile not found</div>
            <Link to="/" className="text-sm text-white underline hover:text-[#A0A0A0]">
              Return to Home
            </Link>
          </div>
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="section-label mb-1">ACCOUNT</div>
            <h1 className="text-xl font-semibold text-white">Profile</h1>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                onClick={() => {
                  if (profile) setOriginalProfile({ ...profile });
                  setIsEditing(true);
                }}
                className="bg-accent text-white text-sm font-medium py-2 px-4 rounded-md hover:bg-accent-dark transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="text-sm text-[#6B6B6B] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-accent text-white text-sm font-medium py-2 px-4 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mb-6 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Registration status row */}
        <div className="border-t border-white/5 py-4 flex items-center justify-between mb-6">
          <span className="text-xs font-medium text-[#A0A0A0]">Registration Status</span>
          <span className="flex items-center gap-2 text-sm">
            <span className={`status-dot ${profile.registrationStatus === 'registered' ? 'bg-green-400' : 'bg-[#6B6B6B]'}`}></span>
            <span className="text-white">
              {profile.registrationStatus === 'registered' ? 'Registered' : 'Not Registered'}
            </span>
          </span>
        </div>

        {/* Profile form */}
        <form className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name</label>
              <input
                type="text"
                name="firstName"
                value={profile.firstName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={isEditing ? inputCls : inputDisabledCls}
              />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={profile.lastName}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={isEditing ? inputCls : inputDisabledCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleInputChange}
              disabled={!isEditing}
              className={isEditing ? inputCls : inputDisabledCls}
            />
            {fieldErrors.email && (
              <div className="mt-1 text-red-400 text-xs">
                {typeof fieldErrors.email === 'string' ? fieldErrors.email : fieldErrors.email.message}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={profile.phone}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="(555) 123-4567"
              className={isEditing ? inputCls : inputDisabledCls}
            />
            {fieldErrors.phone && (
              <div className="mt-1 text-red-400 text-xs">{fieldErrors.phone as string}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={profile.dateOfBirth}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={isEditing ? inputCls : inputDisabledCls}
              />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select
                name="gender"
                value={profile.gender}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={isEditing ? inputCls : inputDisabledCls}
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="pt-1">
            <label className={`flex items-start gap-3 ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                name="communicationsAccepted"
                checked={profile.communicationsAccepted}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0 ${!isEditing ? 'opacity-50' : ''}`}
              />
              <span className="text-xs text-[#A0A0A0] leading-relaxed">
                I consent to receive communications about league activities, schedules, and updates via email.
              </span>
            </label>
          </div>
        </form>

        {/* League Information */}
        {profile.registrationStatus === 'registered' && (
          <div className="border-t border-white/5 mt-10 pt-8">
            <div className="section-label mb-4">LEAGUE INFORMATION</div>
            <div className="space-y-0">
              <div className="border-b border-white/5 py-3 flex justify-between items-center">
                <span className="text-xs text-[#A0A0A0]">Team</span>
                <span className="text-sm text-white">{profile.teamId || 'Not assigned'}</span>
              </div>
              <div className="border-b border-white/5 py-3 flex justify-between items-center">
                <span className="text-xs text-[#A0A0A0]">Registration Date</span>
                <span className="text-sm text-white">
                  {profile.registrationDate ? new Date(profile.registrationDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="border-b border-white/5 py-3 flex justify-between items-center">
                <span className="text-xs text-[#A0A0A0]">Season Status</span>
                <span className="flex items-center gap-2 text-sm text-white">
                  <span className="status-dot bg-green-400"></span>
                  Active
                </span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-xs text-[#A0A0A0]">Next Game</span>
                <span className="text-sm text-white">Tuesday, 6:00 PM at Salem Common</span>
              </div>
            </div>
          </div>
        )}

        {/* My Groups */}
        <div className="border-t border-white/5 mt-10 pt-8">
          <div className="section-label mb-4">MY GROUPS</div>
          {groupsLoading ? (
            <div className="text-sm text-[#6B6B6B]">Loading groups…</div>
          ) : myGroups.length === 0 ? (
            <div className="text-sm text-[#6B6B6B]">You are not part of any groups yet.</div>
          ) : (
            <div className="space-y-6">
              {myGroups.map((group) => (
                <div key={group.group_id} className="bg-[#111111] border border-white/5 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-white">{group.group_name}</div>
                      <div className="text-xs text-[#6B6B6B] mt-0.5">{group.league_name}</div>
                    </div>
                    {group.is_organizer && (
                      <span className="text-xs text-accent border border-accent/20 rounded-full px-2 py-0.5">Organizer</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.members.map((member, idx) => (
                      <div key={member.player_id || member.invitation_id || idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`status-dot ${
                            member.status === 'confirmed' ? 'bg-accent' :
                            member.status === 'pending_invite' ? 'bg-yellow-400' :
                            'bg-[#6B6B6B]'
                          }`} />
                          <span className="text-xs text-[#A0A0A0]">
                            {member.first_name} {member.last_name}
                            {member.is_organizer && <span className="text-[#6B6B6B] ml-1">(you)</span>}
                          </span>
                          <span className="text-xs text-[#6B6B6B]">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#6B6B6B]">
                            {member.status === 'confirmed' ? 'Confirmed' :
                             member.status === 'pending_invite' ? 'Invite sent' :
                             member.status}
                          </span>
                          {group.is_organizer && member.status === 'pending_invite' && member.invitation_id && (
                            <button
                              onClick={() => handleRevokeInvitation(member.invitation_id!)}
                              className="text-xs text-[#6B6B6B] hover:text-red-400 transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="border-t border-white/5 mt-10 pt-6">
          <div className="section-label mb-4">QUICK LINKS</div>
          <div className="flex flex-wrap gap-6">
            <Link to="/rules" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              League Rules <span>→</span>
            </Link>
            <Link to="/" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              Schedule <span>→</span>
            </Link>
            <Link to="/contact" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              Contact League <span>→</span>
            </Link>
          </div>
        </div>

      </div>
    </BaseLayout>
  );
} 