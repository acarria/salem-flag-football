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

  const inputCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const inputErrCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-red-500/60 focus:border-red-500/80 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const labelCls = 'block text-xs font-medium text-[#A0A0A0] mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-semibold text-white">Register for League</h2>
          <button
            className="text-[#6B6B6B] hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
            onClick={onClose}
            aria-label="Close registration modal"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Registration Type Tabs */}
        <div className="flex gap-6 mb-6 border-b border-white/5 pb-0">
          <button
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${type === 'solo' ? 'border-white text-white' : 'border-transparent text-[#6B6B6B] hover:text-white'}`}
            onClick={() => { setType('solo'); setError(''); setSuccess(''); setFieldErrors({}); setTouched({}); setSubmitAttempted(false); }}
          >
            Solo
          </button>
          <button
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${type === 'group' ? 'border-white text-white' : 'border-transparent text-[#6B6B6B] hover:text-white'}`}
            onClick={() => { setType('group'); setError(''); setSuccess(''); setGroup(getInitialGroup()); setFieldErrors({}); setTouched({}); setSubmitAttempted(false); }}
          >
            Group
          </button>
        </div>

        {/* League Selection */}
        {isLoading ? (
          <div className="mb-5 flex items-center gap-2 text-[#6B6B6B] text-sm">
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            Loading leagues...
          </div>
        ) : leagues.length > 0 ? (
          <div className="mb-5">
            <label className={labelCls}>League</label>
            <select
              value={selectedLeague || ''}
              onChange={(e) => handleLeagueChange(e.target.value)}
              onBlur={() => handleBlur('league')}
              className={getVisibleError('league') ? inputErrCls : inputCls}
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
          <div className="mb-5 text-sm text-red-400">No active leagues available at this time.</div>
        )}

        {/* Description */}
        <div className="mb-5">
          {type === 'solo' ? (
            <p className="text-sm text-[#A0A0A0]">
              {userProfile
                ? 'Your profile has been pre-filled. Review and complete any missing fields to register.'
                : 'Register as an individual player for the league.'}
            </p>
          ) : (
            <div className="text-sm text-[#A0A0A0] space-y-1">
              <p>Register with friends to stay together during team formation. Each invitee will receive an email to accept.</p>
              <p>Groups of 2–7 players. May be combined with others to form complete teams.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'solo' ? (
            <>
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input
                    className={getVisibleError('firstName') ? inputErrCls : inputCls}
                    name="firstName"
                    placeholder="First"
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
                  <label className={labelCls}>Last Name</label>
                  <input
                    className={getVisibleError('lastName') ? inputErrCls : inputCls}
                    name="lastName"
                    placeholder="Last"
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
                <label className={labelCls}>Email</label>
                <input
                  className={getVisibleError('email') ? inputErrCls : inputCls}
                  name="email"
                  placeholder="you@example.com"
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
                          className="underline text-[#A0A0A0] hover:text-white"
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

              {/* Phone */}
              <div>
                <label className={labelCls}>Phone</label>
                <div className="flex gap-2">
                  <select
                    value={countryIso}
                    onChange={handleCountryChange}
                    className="flex-shrink-0 px-2 py-2 bg-[#1E1E1E] border border-white/10 text-white text-sm rounded-md outline-none transition-colors"
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
                    className={`flex-1 ${getVisibleError('phone') ? inputErrCls : inputCls}`}
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
                {solo.phone && (
                  <p className="text-[#6B6B6B] text-xs mt-1 pl-1">
                    International format: <span className="text-[#A0A0A0]">{phonePreview}</span>
                  </p>
                )}
                {getVisibleError('phone') && (
                  <p className="text-red-400 text-xs mt-1">{getVisibleError('phone') as string}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input
                  className={getVisibleError('dateOfBirth') ? inputErrCls : inputCls}
                  name="dateOfBirth"
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
                <label className={labelCls}>Gender</label>
                <select
                  className={getVisibleError('gender') ? inputErrCls : inputCls}
                  name="gender"
                  value={solo.gender}
                  onChange={handleInput}
                  onBlur={() => handleBlur('gender')}
                >
                  <option value="">Select...</option>
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
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={solo.termsAccepted}
                    onChange={handleInput}
                    onBlur={() => handleBlur('termsAccepted')}
                    className="mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0"
                  />
                  <span className="text-xs text-[#A0A0A0] leading-relaxed">
                    I agree to the{' '}
                    <a href="/terms" className="text-white underline hover:text-[#A0A0A0]">
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
                    className="mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0"
                  />
                  <span className="text-xs text-[#A0A0A0] leading-relaxed">
                    I consent to receive communications about league activities, schedules, and updates via email.
                  </span>
                </label>
              </div>

              {/* Missing fields summary */}
              {submitAttempted && hasErrors && !isLeagueRegistered && (
                <div className="border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-medium mb-1">Please complete the following:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {missingFields.map(f => (
                      <li key={f} className="text-red-400/80 text-xs">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Group Name</label>
                <input
                  className={getVisibleError('groupName') ? inputErrCls : inputCls}
                  name="groupName"
                  placeholder="e.g. The Friends, Work Buddies"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  onBlur={() => handleBlur('groupName')}
                  autoComplete="off"
                />
                {getVisibleError('groupName') && (
                  <p className="text-red-400 text-xs mt-1">{getVisibleError('groupName') as string}</p>
                )}
              </div>

              {group.map((player, idx) => (
                <div key={idx} className="border-t border-white/5 pt-4 space-y-3">
                  <div className="section-label">Invitee {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>First Name</label>
                      <input
                        className={getVisibleError(`player${idx}_firstName`) ? inputErrCls : inputCls}
                        name="firstName"
                        placeholder="First"
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
                      <label className={labelCls}>Last Name</label>
                      <input
                        className={getVisibleError(`player${idx}_lastName`) ? inputErrCls : inputCls}
                        name="lastName"
                        placeholder="Last"
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
                    <label className={labelCls}>Email</label>
                    <input
                      className={getVisibleError(`player${idx}_email`) ? inputErrCls : inputCls}
                      name="email"
                      placeholder="invitee@example.com"
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
                              className="underline text-[#A0A0A0] hover:text-white"
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

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  className="text-sm text-[#A0A0A0] hover:text-white transition-colors disabled:opacity-40"
                  disabled={group.length >= MAX_GROUP_SIZE}
                >
                  + Add invitee
                </button>
                {group.length > MIN_GROUP_SIZE && (
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(group.length - 1)}
                    className="text-sm text-[#6B6B6B] hover:text-red-400 transition-colors"
                  >
                    Remove last
                  </button>
                )}
              </div>
            </>
          )}

          {error && <div className="text-red-400 text-sm">{error}</div>}
          {success && <div className="text-green-400 text-sm">{success}</div>}

          <button
            type="submit"
            className="w-full bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            disabled={isLeagueRegistered}
          >
            {isLeagueRegistered
              ? 'Already Registered'
              : type === 'solo'
              ? 'Register'
              : 'Register Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
