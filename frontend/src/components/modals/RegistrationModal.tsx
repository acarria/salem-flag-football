import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getEmailError, getPhoneError } from '../../utils/validation';
import apiService, { UserProfile, League } from '../../services/api';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistrationComplete?: () => void;
}

type RegistrationType = 'solo' | 'group';

const MAX_GROUP_SIZE = 7;
const MIN_GROUP_SIZE = 2;

function getInitialGroup() {
  return Array(MIN_GROUP_SIZE).fill({ 
    firstName: '', 
    lastName: '', 
    email: ''
  });
}

export default function RegistrationModal({ isOpen, onClose, onRegistrationComplete }: RegistrationModalProps) {
  const { user } = useUser();
  const [type, setType] = useState<RegistrationType>('solo');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [solo, setSolo] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    phone: '', 
    dateOfBirth: '', 
    gender: '',
    termsAccepted: false,
    communicationsAccepted: false
  });
  const [groupName, setGroupName] = useState('');
  const [group, setGroup] = useState(getInitialGroup());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Update fieldErrors type
  type EmailErrorType = string | { message: string; suggestion: string };
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string | EmailErrorType }>({});

  // Load leagues and user profile when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          // Load active leagues
          const leaguesData = await apiService.getActiveLeagues();
          setLeagues(leaguesData);
          if (leaguesData.length > 0) {
            setSelectedLeague(leaguesData[0].id); // Select first league by default
          }

          // Load user profile
          const profile = await apiService.getUserProfile(user.id);
          setUserProfile(profile);

          // Pre-fill solo registration with user profile data
          if (profile && type === 'solo') {
            setSolo(prev => ({
              ...prev,
              firstName: profile.firstName || user.firstName || '',
              lastName: profile.lastName || user.lastName || '',
              email: profile.email || user.primaryEmailAddress?.emailAddress || '',
              phone: profile.phone || '',
              dateOfBirth: profile.dateOfBirth || '',
              gender: profile.gender || '',
              communicationsAccepted: profile.communicationsAccepted || false,
              termsAccepted: false // Always start unchecked
            }));
          } else if (user && type === 'solo') {
            // Fallback to Clerk data if no profile exists
            setSolo(prev => ({
              ...prev,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.primaryEmailAddress?.emailAddress || '',
            }));
          }

          // Pre-fill first player in group with user profile data
          if (profile && type === 'group') {
            const updatedGroup = [...group];
            updatedGroup[0] = {
              firstName: profile.firstName || user.firstName || '',
              lastName: profile.lastName || user.lastName || '',
              email: profile.email || user.primaryEmailAddress?.emailAddress || ''
            };
            setGroup(updatedGroup);
          } else if (user && type === 'group') {
            // Fallback to Clerk data if no profile exists
            const updatedGroup = [...group];
            updatedGroup[0] = {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.primaryEmailAddress?.emailAddress || ''
            };
            setGroup(updatedGroup);
          }
        } catch (err) {
          console.error('Failed to load registration data:', err);
          setError('Failed to load leagues. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  }, [isOpen, user, type]);

  if (!isOpen) return null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, idx?: number) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFieldErrors({});
    if (typeof idx === 'number') {
      const updated = [...group];
      updated[idx] = { 
        ...updated[idx], 
        [name]: type === 'checkbox' ? checked : value 
      };
      setGroup(updated);
    } else {
      setSolo(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleAddPlayer = () => {
    if (group.length < MAX_GROUP_SIZE) {
      setGroup([...group, { 
        firstName: '', 
        lastName: '', 
        email: ''
      }]);
    }
  };

  const handleRemovePlayer = (idx: number) => {
    if (group.length > MIN_GROUP_SIZE) {
      setGroup(group.filter((_, i) => i !== idx));
    }
  };

  const validateSolo = () => {
    const errors: { [key: string]: string | EmailErrorType } = {};
    if (!selectedLeague) errors.league = 'Please select a league.';
    if (!solo.firstName) errors.firstName = 'First name is required.';
    if (!solo.lastName) errors.lastName = 'Last name is required.';
    const emailError = getEmailError(solo.email);
    if (emailError) errors.email = emailError;
    const phoneError = getPhoneError(solo.phone);
    if (phoneError) errors.phone = phoneError;
    if (!solo.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
    if (!solo.gender) errors.gender = 'Gender is required.';
    if (!solo.termsAccepted) errors.termsAccepted = 'You must accept the terms of service.';
    return errors;
  };

  const validateGroup = () => {
    const errors: { [key: string]: string | EmailErrorType } = {};
    if (!selectedLeague) errors.league = 'Please select a league.';
    if (!groupName) errors.groupName = 'Group name is required.';
    if (group.length < MIN_GROUP_SIZE) errors.group = 'A group must have at least 2 players.';
    group.forEach((player, idx) => {
      if (!player.firstName) errors[`player${idx}_firstName`] = 'First name required.';
      if (!player.lastName) errors[`player${idx}_lastName`] = 'Last name required.';
      const emailError = getEmailError(player.email);
      if (emailError) errors[`player${idx}_email`] = emailError;
    });
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    
    if (type === 'solo') {
      const errors = validateSolo();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please fix the errors above.');
        return;
      }

      try {
        // Create user profile from registration data
        const userProfile: UserProfile = {
          firstName: solo.firstName,
          lastName: solo.lastName,
          email: solo.email,
          phone: solo.phone,
          dateOfBirth: solo.dateOfBirth,
          gender: solo.gender,
          communicationsAccepted: solo.communicationsAccepted,
          registrationStatus: 'registered', // Mark as registered
          teamId: undefined, // Will be assigned when teams are created
          groupName: undefined,
          registrationDate: new Date().toISOString().split('T')[0], // Today's date
          paymentStatus: 'pending', // Will be updated when payment is processed
          waiverStatus: 'pending',   // Will be updated when waiver is signed
          leagueId: selectedLeague || undefined // Store the selected league ID
        };

        // Save to user profile
        if (user) {
          await apiService.updateUserProfile(user.id, userProfile);
          const selectedLeagueData = leagues.find(l => l.id === selectedLeague);
          const leagueName = selectedLeagueData ? selectedLeagueData.name : 'the league';
          setSuccess(`League registration submitted successfully! Welcome to ${leagueName}! Your profile has been updated.`);
          
          // Notify parent that registration is complete
          if (onRegistrationComplete) {
            onRegistrationComplete();
          }
          
          // Close modal after a short delay
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError('User not found. Please try signing in again.');
        }
      } catch (err) {
        console.error('Failed to save registration:', err);
        setError('Failed to save registration. Please try again.');
      }
    } else {
      const errors = validateGroup();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please fix the errors above.');
        return;
      }
      setSuccess(`Group registration submitted! Invitations will be sent to ${group.length} players. Your group will be kept together during team formation.`);
      // TODO: Send to backend - this will trigger email invitations and mark as a group
    }
  };

  // Check if form is valid for submit button
  const isFormValid = () => {
    if (type === 'solo') {
      return selectedLeague &&
             solo.firstName &&
             solo.lastName &&
             !getEmailError(solo.email) &&
             !getPhoneError(solo.phone) &&
             solo.phone &&
             solo.dateOfBirth &&
             solo.gender &&
             solo.termsAccepted;
    } else {
      if (!selectedLeague || !groupName || group.length < MIN_GROUP_SIZE) return false;
      
      return group.every(player => 
        player.firstName && 
        player.lastName && 
        !getEmailError(player.email)
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <button
          className="absolute top-2 right-2 text-pumpkin hover:text-deeporange text-2xl font-bold"
          onClick={onClose}
          aria-label="Close registration modal"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-pumpkin mb-4 text-center">Register for League</h2>
        
        {/* Registration Type Selection */}
        <div className="flex justify-center mb-4 gap-2">
          <button
            className={`px-4 py-2 rounded font-bold border-2 ${type === 'solo' ? 'bg-pumpkin text-black border-pumpkin' : 'bg-black text-pumpkin border-pumpkin'} transition-colors`}
            onClick={() => { setType('solo'); setError(''); setSuccess(''); setFieldErrors({}); }}
          >
            Solo
          </button>
          <button
            className={`px-4 py-2 rounded font-bold border-2 ${type === 'group' ? 'bg-pumpkin text-black border-pumpkin' : 'bg-black text-pumpkin border-pumpkin'} transition-colors`}
            onClick={() => { setType('group'); setError(''); setSuccess(''); setGroup(getInitialGroup()); setFieldErrors({}); }}
          >
            Group
          </button>
        </div>

        {/* League Selection */}
        {isLoading ? (
          <div className="mb-4 p-3 bg-black bg-opacity-50 rounded-lg">
            <p className="text-sm text-gray-300 text-center">Loading leagues...</p>
          </div>
        ) : leagues.length > 0 ? (
          <div className="mb-4 p-3 bg-black bg-opacity-50 rounded-lg">
            <label className="block text-sm font-semibold text-pumpkin mb-2">Select League:</label>
            <select
              value={selectedLeague || ''}
              onChange={(e) => setSelectedLeague(Number(e.target.value))}
              className={`w-full p-2 rounded bg-black border text-white focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.league ? 'border-red-500' : 'border-pumpkin'}`}
            >
              <option value="">Select a league...</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} - {league.description}
                </option>
              ))}
            </select>
            {fieldErrors.league && <div className="text-red-400 text-xs mt-1">{fieldErrors.league as string}</div>}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
            <p className="text-sm text-red-300 text-center">No active leagues available at this time.</p>
          </div>
        )}

        {/* Registration Type Description */}
        <div className="mb-4 p-3 bg-black bg-opacity-50 rounded-lg">
          {type === 'solo' ? (
            <p className="text-sm text-gray-300">
              {userProfile ? 'Your profile information has been pre-filled. Review and complete any missing fields to register for the league.' : 'Register as an individual player for the league.'}
            </p>
          ) : (
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Group Registration:</strong> Register with friends to ensure you stay together during team formation.</p>
              <p>• Groups of 2-7 players</p>
              <p>• All members must accept invitations</p>
              <p>• System will try to keep your group together</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'solo' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                  name="firstName"
                  placeholder="First Name"
                  value={solo.firstName}
                  onChange={handleInput}
                  autoComplete="given-name"
                  readOnly={!!user?.firstName}
                />
                <input
                  className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                  name="lastName"
                  placeholder="Last Name"
                  value={solo.lastName}
                  onChange={handleInput}
                  autoComplete="family-name"
                  readOnly={!!user?.lastName}
                />
              </div>
              {typeof fieldErrors.firstName === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.firstName as string}</div>}
              {typeof fieldErrors.lastName === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.lastName as string}</div>}
              
              <input
                className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.email ? 'border-red-500' : ''}`}
                name="email"
                placeholder="Email"
                value={solo.email}
                onChange={handleInput}
                autoComplete="email"
                type="email"
                readOnly={!!user?.primaryEmailAddress?.emailAddress}
              />
              {(() => {
                const error = fieldErrors.email;
                if (!error) return null;
                if (typeof error === 'object' && typeof error.suggestion === 'string') {
                  return (
                    <div className="text-red-400 text-xs mb-1">
                      {error.message}{' '}
                      <button
                        type="button"
                        className="underline text-pumpkin hover:text-deeporange"
                        onClick={() => setSolo(prev => ({ ...prev, email: error.suggestion || prev.email }))}
                      >
                        Yes
                      </button>
                    </div>
                  );
                }
                return <div className="text-red-400 text-xs mb-1">{error as string}</div>;
              })()}
              
              <input
                className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.phone ? 'border-red-500' : ''}`}
                name="phone"
                placeholder="Phone"
                value={solo.phone}
                onChange={handleInput}
                autoComplete="tel"
                type="tel"
              />
              {typeof fieldErrors.phone === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.phone as string}</div>}
              
              <input
                className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.dateOfBirth ? 'border-red-500' : ''}`}
                name="dateOfBirth"
                placeholder="Date of Birth"
                value={solo.dateOfBirth}
                onChange={handleInput}
                autoComplete="bday"
                type="date"
              />
              {typeof fieldErrors.dateOfBirth === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.dateOfBirth as string}</div>}
              
              <select
                className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.gender ? 'border-red-500' : ''}`}
                name="gender"
                value={solo.gender}
                onChange={handleInput}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              {typeof fieldErrors.gender === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.gender as string}</div>}
              
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={solo.termsAccepted}
                    onChange={handleInput}
                    className="mt-1 w-4 h-4 text-pumpkin bg-black border-pumpkin rounded focus:ring-pumpkin focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">
                    I agree to the <a href="/terms" className="text-pumpkin hover:text-deeporange underline">Terms of Service</a> and acknowledge that by registering, I am bound by these terms.
                  </span>
                </label>
                {typeof fieldErrors.termsAccepted === 'string' && <div className="text-red-400 text-xs">{fieldErrors.termsAccepted as string}</div>}
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="communicationsAccepted"
                    checked={solo.communicationsAccepted}
                    onChange={handleInput}
                    className="mt-1 w-4 h-4 text-pumpkin bg-black border-pumpkin rounded focus:ring-pumpkin focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">
                    I consent to receive communications about league activities, schedules, and updates via email.
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <input
                className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.groupName ? 'border-red-500' : ''}`}
                name="groupName"
                placeholder="Group Name (e.g., 'The Friends', 'Work Buddies')"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                autoComplete="off"
              />
              {typeof fieldErrors.groupName === 'string' && <div className="text-red-400 text-xs mb-1">{fieldErrors.groupName as string}</div>}
              
              <div className="text-sm text-gray-300 mb-4 p-3 bg-black bg-opacity-30 rounded">
                <p>📧 <strong>Group Invite System:</strong> Enter your friends' information below. Each person will receive an email invitation to join your group.</p>
                <p className="mt-2 text-xs">💡 <strong>Note:</strong> Your group will be kept together during team formation, but may be combined with other players to form complete teams.</p>
              </div>
              
              {group.map((player, idx) => (
                <div key={idx} className="flex flex-col gap-2 mb-4 p-3 bg-black bg-opacity-30 rounded">
                  <h4 className="text-pumpkin font-semibold">Group Member {idx + 1}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors[`player${idx}_firstName`] ? 'border-red-500' : ''}`}
                      name="firstName"
                      placeholder="First Name"
                      value={player.firstName}
                      onChange={e => handleInput(e, idx)}
                      autoComplete="off"
                    />
                    <input
                      className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors[`player${idx}_lastName`] ? 'border-red-500' : ''}`}
                      name="lastName"
                      placeholder="Last Name"
                      value={player.lastName}
                      onChange={e => handleInput(e, idx)}
                      autoComplete="off"
                    />
                  </div>
                  {typeof fieldErrors[`player${idx}_firstName`] === 'string' && (
                    <div className="text-red-400 text-xs mb-1">{fieldErrors[`player${idx}_firstName`] as string}</div>
                  )}
                  {typeof fieldErrors[`player${idx}_lastName`] === 'string' && (
                    <div className="text-red-400 text-xs mb-1">{fieldErrors[`player${idx}_lastName`] as string}</div>
                  )}
                  <input
                    className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors[`player${idx}_email`] ? 'border-red-500' : ''}`}
                    name="email"
                    placeholder="Email Address"
                    value={player.email}
                    onChange={e => handleInput(e, idx)}
                    autoComplete="off"
                    type="email"
                  />
                  {(() => {
                    const error = fieldErrors[`player${idx}_email`];
                    if (!error) return null;
                    if (typeof error === 'object' && typeof error.suggestion === 'string') {
                      return (
                        <div className="text-red-400 text-xs mb-1">
                          {error.message}{' '}
                          <button
                            type="button"
                            className="underline text-pumpkin hover:text-deeporange"
                            onClick={() => {
                              const updated = [...group];
                              updated[idx].email = error.suggestion;
                              setGroup(updated);
                            }}
                          >
                            Yes
                          </button>
                        </div>
                      );
                    }
                    if (typeof error === 'string') {
                      return <div className="text-red-400 text-xs mb-1">{error as string}</div>;
                    }
                    return null;
                  })()}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddPlayer}
                className="w-full p-2 rounded bg-pumpkin text-black font-bold hover:bg-deeporange transition-colors"
                disabled={group.length >= MAX_GROUP_SIZE}
              >
                Add Player
              </button>
              {group.length > MIN_GROUP_SIZE && (
                <button
                  type="button"
                  onClick={() => handleRemovePlayer(group.length - 1)}
                  className="w-full p-2 rounded bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
                >
                  Remove Last Player
                </button>
              )}
            </>
          )}

          {error && <div className="text-red-400 text-center">{error}</div>}
          {success && <div className="text-green-400 text-center">{success}</div>}

          <button
            type="submit"
            className="w-full p-2 rounded bg-pumpkin text-black font-bold hover:bg-deeporange transition-colors"
            disabled={!isFormValid()}
          >
            {type === 'solo' ? 'Register Solo' : 'Register Group'}
          </button>
        </form>
      </div>
    </div>
  );
}