import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import BaseLayout from '../components/layout/BaseLayout';
import { getEmailError, getPhoneError } from '../utils/validation';
import apiService, { UserProfile } from '../services/api';

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setProfile(prev => prev ? {
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
      await apiService.updateUserProfile(user.id, profile);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original profile data
    if (user) {
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
    }
    setIsEditing(false);
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  if (isLoading) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-pumpkin text-xl">Loading profile...</div>
          </div>
        </div>
      </BaseLayout>
    );
  }

  if (!profile) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-400 text-xl mb-4">Profile not found</div>
            <Link to="/" className="text-pumpkin hover:text-deeporange">
              Return to Home
            </Link>
          </div>
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <div className="max-w-4xl mx-auto p-4">
        {/* Profile Header */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-pumpkin">Profile Information</h2>
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded bg-pumpkin text-black font-bold hover:bg-deeporange transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded border-2 border-pumpkin text-pumpkin font-bold hover:bg-pumpkin hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`px-4 py-2 rounded font-bold transition-colors ${
                      isSaving 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-pumpkin text-black hover:bg-deeporange'
                    }`}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-300">
              {success}
            </div>
          )}

          {/* Registration Status */}
          <div className="mb-4 p-3 bg-black bg-opacity-30 rounded border border-pumpkin">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Registration Status:</span>
              <span className={`font-bold ${
                profile.registrationStatus === 'registered' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {profile.registrationStatus === 'registered' ? 'Registered' : 'Not Registered'}
              </span>
            </div>
            {profile.registrationStatus === 'registered' && profile.teamId && (
              <span className="text-gray-300">• Team ID: {profile.teamId}</span>
            )}
          </div>

          {/* Profile Form */}
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                    !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                    !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                  !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              {fieldErrors.email && (
                <div className="mt-1 text-red-400 text-sm">
                  {typeof fieldErrors.email === 'string' 
                    ? fieldErrors.email 
                    : fieldErrors.email.message
                  }
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="(555) 123-4567"
                className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                  !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              {fieldErrors.phone && (
                <div className="mt-1 text-red-400 text-sm">{fieldErrors.phone as string}</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={profile.dateOfBirth}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                    !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Gender</label>
                <select
                  name="gender"
                  value={profile.gender}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full p-3 rounded bg-black border border-pumpkin text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${
                    !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="communicationsAccepted"
                  checked={profile.communicationsAccepted}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`mt-1 w-4 h-4 text-pumpkin bg-black border-pumpkin rounded focus:ring-pumpkin focus:ring-2 ${
                    !isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <span className="text-sm text-gray-300">
                  I consent to receive communications about league activities, schedules, and updates via email.
                </span>
              </label>
            </div>
          </form>
        </div>

        {/* League Information */}
        {profile.registrationStatus === 'registered' && (
          <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
            <h3 className="text-xl font-bold text-pumpkin mb-4">League Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Current Team</h4>
                <p className="text-pumpkin font-bold">Team ID: {profile.teamId || 'Not assigned'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Registration Date</h4>
                <p className="text-white">{profile.registrationDate ? new Date(profile.registrationDate).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Season Status</h4>
                <p className="text-green-400">Active</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Next Game</h4>
                <p className="text-white">Tuesday, 6:00 PM at Salem Common</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6 mt-6">
          <h3 className="text-xl font-bold text-pumpkin mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              to="/rules" 
              className="p-4 bg-black bg-opacity-30 rounded-lg border border-pumpkin hover:bg-pumpkin hover:text-black transition-colors text-center"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="font-semibold">View Rules</div>
            </Link>
            <Link 
              to="/" 
              className="p-4 bg-black bg-opacity-30 rounded-lg border border-pumpkin hover:bg-pumpkin hover:text-black transition-colors text-center"
            >
              <div className="text-2xl mb-2">📅</div>
              <div className="font-semibold">View Schedule</div>
            </Link>
            <Link 
              to="/contact" 
              className="p-4 bg-black bg-opacity-30 rounded-lg border border-pumpkin hover:bg-pumpkin hover:text-black transition-colors text-center"
            >
              <div className="text-2xl mb-2">📞</div>
              <div className="font-semibold">Contact League</div>
            </Link>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
} 