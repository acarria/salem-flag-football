import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAuthenticatedApi } from '../../hooks/useAuthenticatedApi';
import {
  getEmailError,
  getPhoneErrorForCountry,
  formatPhoneLocal,
  getFullPhoneDisplay,
  normalizePhoneDigits,
  COUNTRIES,
} from '../../utils/validation';
import { apiService, UserProfile, League } from '../../services';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistrationComplete?: () => void;
}

type RegistrationType = 'solo' | 'group';

const MAX_GROUP_SIZE = 6;  // max invitees (organizer is separate)
const MIN_GROUP_SIZE = 1;  // at least 1 invitee

function getInitialGroup() {
  return Array(MIN_GROUP_SIZE).fill({ firstName: '', lastName: '', email: '' });
}

type EmailErrorType = string | { message: string; suggestion: string };

export default function RegistrationModal({ isOpen, onClose, onRegistrationComplete }: RegistrationModalProps) {
  const { user } = useUser();
  const { request: authenticatedRequest } = useAuthenticatedApi();
  const [type, setType] = useState<RegistrationType>('solo');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countryIso, setCountryIso] = useState('US');
  const [solo, setSolo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '', // stores raw local digits only
    dateOfBirth: '',
    gender: '',
    termsAccepted: false,
    communicationsAccepted: false,
  });
  const [groupName, setGroupName] = useState('');
  const [group, setGroup] = useState(getInitialGroup());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string | EmailErrorType }>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLeagueRegistered, setIsLeagueRegistered] = useState(false);

  // Load leagues and user profile when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const leaguesData = await apiService.getActiveLeagues();
          setLeagues(leaguesData);
          if (leaguesData.length > 0) {
            setSelectedLeague(leaguesData[0].id);
          }

          const profile = await apiService.getUserProfile(user.id);
          setUserProfile(profile);

          if (leaguesData.length > 0) {
            await checkLeagueRegistrationStatus(leaguesData[0].id);
          }

          if (profile && type === 'solo') {
            const rawPhone = normalizePhoneDigits(profile.phone || '', 'US');
            setSolo(prev => ({
              ...prev,
              firstName: profile.firstName || user.firstName || '',
              lastName: profile.lastName || user.lastName || '',
              email: profile.email || user.primaryEmailAddress?.emailAddress || '',
              phone: rawPhone,
              dateOfBirth: profile.dateOfBirth || '',
              gender: profile.gender || '',
              communicationsAccepted: profile.communicationsAccepted || false,
              termsAccepted: false,
            }));
          } else if (user && type === 'solo') {
            setSolo(prev => ({
              ...prev,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.primaryEmailAddress?.emailAddress || '',
            }));
          }

          // Group invitee slots start blank — organizer is registered automatically
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

  const validateSolo = () => {
    const errors: { [key: string]: string | EmailErrorType } = {};
    if (!selectedLeague) errors.league = 'Please select a league.';
    if (!solo.firstName) errors.firstName = 'First name is required.';
    if (!solo.lastName) errors.lastName = 'Last name is required.';
    const emailError = getEmailError(solo.email);
    if (emailError) errors.email = emailError;
    const phoneError = getPhoneErrorForCountry(solo.phone, countryIso);
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

  // Re-validate live whenever form values change
  useEffect(() => {
    if (type === 'solo') {
      setFieldErrors(validateSolo());
    } else {
      setFieldErrors(validateGroup());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solo, group, groupName, selectedLeague, countryIso, type]);

  if (!isOpen) return null;

  const checkLeagueRegistrationStatus = async (leagueId: string) => {
    if (!user) return;
    try {
      const result = await apiService.checkLeagueRegistration(user.id, leagueId);
      setIsLeagueRegistered(result.isRegistered);
      if (result.isRegistered) {
        setError('You are already registered for this league. You cannot register twice.');
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Failed to check registration status:', err);
      setIsLeagueRegistered(false);
    }
  };

  const handleLeagueChange = async (leagueId: string) => {
    setSelectedLeague(leagueId);
    setError('');
    await checkLeagueRegistrationStatus(leagueId);
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, idx?: number) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (typeof idx === 'number') {
      setTouched(prev => ({ ...prev, [`player${idx}_${name}`]: true }));
      const updated = [...group];
      updated[idx] = { ...updated[idx], [name]: type === 'checkbox' ? checked : value };
      setGroup(updated);
    } else {
      setTouched(prev => ({ ...prev, [name]: true }));
      setSolo(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  // Phone input handler: strip to raw local digits only
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = normalizePhoneDigits(raw, countryIso);
    setTouched(prev => ({ ...prev, phone: true }));
    setSolo(prev => ({ ...prev, phone: digits }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIso = e.target.value;
    setCountryIso(newIso);
    setTouched(prev => ({ ...prev, phone: true }));
    // Re-normalize digits against the new country's expected length
    setSolo(prev => ({
      ...prev,
      phone: prev.phone.slice(0, COUNTRIES.find(c => c.iso === newIso)?.digitCount ?? 15),
    }));
  };

  const handleAddPlayer = () => {
    if (group.length < MAX_GROUP_SIZE) {
      setGroup([...group, { firstName: '', lastName: '', email: '' }]);
    }
  };

  const handleRemovePlayer = (idx: number) => {
    if (group.length > MIN_GROUP_SIZE) {
      setGroup(group.filter((_, i) => i !== idx));
    }
  };

  // Returns the error for a field only when it should be visible (touched or submit attempted)
  const getVisibleError = (field: string): string | EmailErrorType | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return fieldErrors[field];
  };

  // Human-readable list of what's still missing (for the summary near the submit button)
  const getMissingFields = (): string[] => {
    if (type !== 'solo') return [];
    const labels: { [key: string]: string } = {
      league: 'League selection',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Valid email address',
      phone: 'Valid phone number',
      dateOfBirth: 'Date of birth',
      gender: 'Gender',
      termsAccepted: 'Terms of service acceptance',
    };
    const errors = validateSolo();
    return Object.keys(errors)
      .filter(k => labels[k])
      .map(k => labels[k]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitAttempted(true);

    if (type === 'solo') {
      const errors = validateSolo();
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setError('Please fix the errors highlighted above before submitting.');
        return;
      }

      if (isLeagueRegistered) {
        setError('You are already registered for this league. You cannot register twice.');
        return;
      }

      try {
        await authenticatedRequest('/registration/player', {
          method: 'POST',
          body: JSON.stringify({
            league_id: selectedLeague,
            firstName: solo.firstName,
            lastName: solo.lastName,
            email: solo.email,
            phone: getFullPhoneDisplay(solo.phone, countryIso),
            dateOfBirth: solo.dateOfBirth,
            gender: solo.gender,
            termsAccepted: solo.termsAccepted,
            communicationsAccepted: solo.communicationsAccepted,
          }),
        });
        const selectedLeagueData = leagues.find(l => l.id === selectedLeague);
        const leagueName = selectedLeagueData ? selectedLeagueData.name : 'the league';
        setSuccess(`Registration submitted successfully! Welcome to ${leagueName}!`);
        if (onRegistrationComplete) onRegistrationComplete();
        setTimeout(() => onClose(), 2000);
      } catch (err: any) {
        console.error('Failed to register:', err);
        if (err?.message?.includes('already registered') || err?.response?.data?.detail?.includes('already registered')) {
          setError('You are already registered for this league.');
          setIsLeagueRegistered(true);
        } else {
          setError(err?.message || 'Failed to submit registration. Please try again.');
        }
      }
    } else {
      const errors = validateGroup();
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setError('Please fix the errors highlighted above before submitting.');
        return;
      }
      try {
        await authenticatedRequest('/registration/group', {
          method: 'POST',
          body: JSON.stringify({
            league_id: selectedLeague,
            groupName,
            players: group.map(p => ({ firstName: p.firstName, lastName: p.lastName, email: p.email })),
            termsAccepted: true,
            communicationsAccepted: true,
          }),
        });
        setSuccess(`Group registered! Invitations sent to ${group.length} player(s).`);
        if (onRegistrationComplete) onRegistrationComplete();
        setTimeout(() => onClose(), 2000);
      } catch (err: any) {
        console.error('Failed to register group:', err);
        setError(err?.message || 'Failed to submit group registration. Please try again.');
      }
    }
  };

  const missingFields = getMissingFields();
  const hasErrors = missingFields.length > 0;

  // Phone display values
  const phoneDisplayValue = formatPhoneLocal(solo.phone, countryIso);
  const phonePreview = getFullPhoneDisplay(solo.phone, countryIso);
  const selectedCountry = COUNTRIES.find(c => c.iso === countryIso)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gunmetal border-2 border-accent rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <button
          className="absolute top-2 right-2 text-accent hover:text-accent-dark text-2xl font-bold"
          onClick={onClose}
          aria-label="Close registration modal"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-accent mb-4 text-center">Register for League</h2>

        {/* Registration Type Selection */}
        <div className="flex justify-center mb-4 gap-2">
          <button
            className={`px-4 py-2 rounded font-bold border-2 ${type === 'solo' ? 'bg-accent text-white border-accent' : 'bg-black text-accent border-accent'} transition-colors`}
            onClick={() => { setType('solo'); setError(''); setSuccess(''); setFieldErrors({}); setTouched({}); setSubmitAttempted(false); }}
          >
            Solo
          </button>
          <button
            className={`px-4 py-2 rounded font-bold border-2 ${type === 'group' ? 'bg-accent text-white border-accent' : 'bg-black text-accent border-accent'} transition-colors`}
            onClick={() => { setType('group'); setError(''); setSuccess(''); setGroup(getInitialGroup()); setFieldErrors({}); setTouched({}); setSubmitAttempted(false); }}
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
            <label className="block text-sm font-semibold text-accent mb-2">Select League:</label>
            <select
              value={selectedLeague || ''}
              onChange={(e) => handleLeagueChange(e.target.value)}
              onBlur={() => handleBlur('league')}
              className={`w-full p-2 rounded bg-black border text-white focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('league') ? 'border-red-500' : 'border-accent'}`}
            >
              <option value="">Select a league...</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} - {league.description}
                </option>
              ))}
            </select>
            {getVisibleError('league') && (
              <p className="text-red-400 text-xs mt-1">{getVisibleError('league') as string}</p>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
            <p className="text-sm text-red-300 text-center">No active leagues available at this time.</p>
          </div>
        )}

        {/* Description */}
        <div className="mb-4 p-3 bg-black bg-opacity-50 rounded-lg">
          {type === 'solo' ? (
            <p className="text-sm text-gray-300">
              {userProfile
                ? 'Your profile information has been pre-filled. Review and complete any missing fields to register.'
                : 'Register as an individual player for the league.'}
            </p>
          ) : (
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Group Registration:</strong> Register with friends to stay together during team formation.</p>
              <p>• Groups of 2–7 players</p>
              <p>• All members must accept invitations</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {type === 'solo' ? (
            <>
              {/* Name row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    className={`w-full p-2 rounded bg-black border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('firstName') ? 'border-red-500' : 'border-accent'}`}
                    name="firstName"
                    placeholder="First Name"
                    value={solo.firstName}
                    onChange={handleInput}
                    onBlur={() => handleBlur('firstName')}
                    autoComplete="given-name"
                    readOnly={!!user?.firstName}
                  />
                  {getVisibleError('firstName') && (
                    <p className="text-red-400 text-xs mt-1">{getVisibleError('firstName') as string}</p>
                  )}
                </div>
                <div>
                  <input
                    className={`w-full p-2 rounded bg-black border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('lastName') ? 'border-red-500' : 'border-accent'}`}
                    name="lastName"
                    placeholder="Last Name"
                    value={solo.lastName}
                    onChange={handleInput}
                    onBlur={() => handleBlur('lastName')}
                    autoComplete="family-name"
                    readOnly={!!user?.lastName}
                  />
                  {getVisibleError('lastName') && (
                    <p className="text-red-400 text-xs mt-1">{getVisibleError('lastName') as string}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <input
                  className={`w-full p-2 rounded bg-black border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('email') ? 'border-red-500' : 'border-accent'}`}
                  name="email"
                  placeholder="Email"
                  value={solo.email}
                  onChange={handleInput}
                  onBlur={() => handleBlur('email')}
                  autoComplete="email"
                  type="email"
                  readOnly={!!user?.primaryEmailAddress?.emailAddress}
                />
                {(() => {
                  const err = getVisibleError('email');
                  if (!err) return null;
                  if (typeof err === 'object' && 'suggestion' in err) {
                    return (
                      <p className="text-red-400 text-xs mt-1">
                        {err.message}{' '}
                        <button
                          type="button"
                          className="underline text-accent hover:text-accent-dark"
                          onClick={() => setSolo(prev => ({ ...prev, email: err.suggestion }))}
                        >
                          Use suggestion
                        </button>
                      </p>
                    );
                  }
                  return <p className="text-red-400 text-xs mt-1">{err as string}</p>;
                })()}
              </div>

              {/* Phone: country code dropdown + formatted input */}
              <div>
                <div className="flex gap-2">
                  <select
                    value={countryIso}
                    onChange={handleCountryChange}
                    className="flex-shrink-0 p-2 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    style={{ minWidth: '7rem' }}
                    aria-label="Country code"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.iso} value={c.iso}>
                        {c.flag} +{c.dialCode}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`flex-1 p-2 rounded bg-black border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('phone') ? 'border-red-500' : 'border-accent'}`}
                    name="phone"
                    placeholder={selectedCountry.format.replace(/X/g, '0')}
                    value={phoneDisplayValue}
                    onChange={handlePhoneInput}
                    onBlur={() => handleBlur('phone')}
                    autoComplete="tel-national"
                    type="tel"
                    inputMode="numeric"
                  />
                </div>
                {/* International format preview */}
                {solo.phone && (
                  <p className="text-gray-500 text-xs mt-1 pl-1">
                    International format: <span className="text-gray-300">{phonePreview}</span>
                  </p>
                )}
                {getVisibleError('phone') && (
                  <p className="text-red-400 text-xs mt-1">{getVisibleError('phone') as string}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <input
                  className={`w-full p-2 rounded bg-black border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('dateOfBirth') ? 'border-red-500' : 'border-accent'}`}
                  name="dateOfBirth"
                  placeholder="Date of Birth"
                  value={solo.dateOfBirth}
                  onChange={handleInput}
                  onBlur={() => handleBlur('dateOfBirth')}
                  autoComplete="bday"
                  type="date"
                />
                {getVisibleError('dateOfBirth') && (
                  <p className="text-red-400 text-xs mt-1">{getVisibleError('dateOfBirth') as string}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <select
                  className={`w-full p-2 rounded bg-black border text-white focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('gender') ? 'border-red-500' : 'border-accent'}`}
                  name="gender"
                  value={solo.gender}
                  onChange={handleInput}
                  onBlur={() => handleBlur('gender')}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
                {getVisibleError('gender') && (
                  <p className="text-red-400 text-xs mt-1">{getVisibleError('gender') as string}</p>
                )}
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={solo.termsAccepted}
                    onChange={handleInput}
                    onBlur={() => handleBlur('termsAccepted')}
                    className="mt-1 w-4 h-4 text-accent bg-black border-accent rounded focus:ring-accent focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">
                    I agree to the{' '}
                    <a href="/terms" className="text-accent hover:text-accent-dark underline">
                      Terms of Service
                    </a>{' '}
                    and acknowledge that by registering, I am bound by these terms.
                  </span>
                </label>
                {getVisibleError('termsAccepted') && (
                  <p className="text-red-400 text-xs">{getVisibleError('termsAccepted') as string}</p>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="communicationsAccepted"
                    checked={solo.communicationsAccepted}
                    onChange={handleInput}
                    className="mt-1 w-4 h-4 text-accent bg-black border-accent rounded focus:ring-accent focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">
                    I consent to receive communications about league activities, schedules, and updates via email.
                  </span>
                </label>
              </div>

              {/* Missing fields summary — shown after first submit attempt */}
              {submitAttempted && hasErrors && !isLeagueRegistered && (
                <div className="rounded-lg border border-red-500/40 bg-red-900/20 p-3">
                  <p className="text-red-400 text-xs font-semibold mb-1">Please complete the following:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {missingFields.map(f => (
                      <li key={f} className="text-red-300 text-xs">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <input
                className={`w-full p-2 rounded bg-black border border-accent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError('groupName') ? 'border-red-500' : ''}`}
                name="groupName"
                placeholder="Group Name (e.g., 'The Friends', 'Work Buddies')"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onBlur={() => handleBlur('groupName')}
                autoComplete="off"
              />
              {getVisibleError('groupName') && (
                <p className="text-red-400 text-xs mb-1">{getVisibleError('groupName') as string}</p>
              )}

              <div className="text-sm text-gray-300 mb-4 p-3 bg-black bg-opacity-30 rounded">
                <p>📧 <strong>Group Invite System:</strong> You will be registered immediately. Enter your friends' info below — each will receive an email invitation to accept.</p>
                <p className="mt-2 text-xs">💡 Your group will be kept together during team formation, but may be combined with other players to form complete teams.</p>
              </div>

              {group.map((player, idx) => (
                <div key={idx} className="flex flex-col gap-2 mb-4 p-3 bg-black bg-opacity-30 rounded">
                  <h4 className="text-accent font-semibold">Invitee {idx + 1}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        className={`w-full p-2 rounded bg-black border border-accent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError(`player${idx}_firstName`) ? 'border-red-500' : ''}`}
                        name="firstName"
                        placeholder="First Name"
                        value={player.firstName}
                        onChange={e => handleInput(e, idx)}
                        onBlur={() => handleBlur(`player${idx}_firstName`)}
                        autoComplete="off"
                      />
                      {getVisibleError(`player${idx}_firstName`) && (
                        <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_firstName`) as string}</p>
                      )}
                    </div>
                    <div>
                      <input
                        className={`w-full p-2 rounded bg-black border border-accent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError(`player${idx}_lastName`) ? 'border-red-500' : ''}`}
                        name="lastName"
                        placeholder="Last Name"
                        value={player.lastName}
                        onChange={e => handleInput(e, idx)}
                        onBlur={() => handleBlur(`player${idx}_lastName`)}
                        autoComplete="off"
                      />
                      {getVisibleError(`player${idx}_lastName`) && (
                        <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_lastName`) as string}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <input
                      className={`w-full p-2 rounded bg-black border border-accent text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent ${getVisibleError(`player${idx}_email`) ? 'border-red-500' : ''}`}
                      name="email"
                      placeholder="Email Address"
                      value={player.email}
                      onChange={e => handleInput(e, idx)}
                      onBlur={() => handleBlur(`player${idx}_email`)}
                      autoComplete="off"
                      type="email"
                    />
                    {(() => {
                      const err = getVisibleError(`player${idx}_email`);
                      if (!err) return null;
                      if (typeof err === 'object' && 'suggestion' in err) {
                        return (
                          <p className="text-red-400 text-xs mt-1">
                            {err.message}{' '}
                            <button
                              type="button"
                              className="underline text-accent hover:text-accent-dark"
                              onClick={() => {
                                const updated = [...group];
                                updated[idx].email = err.suggestion;
                                setGroup(updated);
                              }}
                            >
                              Use suggestion
                            </button>
                          </p>
                        );
                      }
                      return <p className="text-red-400 text-xs mt-1">{err as string}</p>;
                    })()}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddPlayer}
                className="w-full p-2 rounded bg-accent text-white font-bold hover:bg-accent-dark transition-colors disabled:opacity-50"
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

          {error && <div className="text-red-400 text-center text-sm">{error}</div>}
          {success && <div className="text-green-400 text-center text-sm">{success}</div>}

          <button
            type="submit"
            className="w-full p-2 rounded bg-accent text-white font-bold hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLeagueRegistered}
          >
            {isLeagueRegistered
              ? 'Already Registered'
              : type === 'solo'
              ? 'Register Solo'
              : 'Register Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
