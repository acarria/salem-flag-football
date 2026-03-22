'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
import { isHttpStatus, getApiErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';
import {
  getEmailError,
  getPhoneErrorForCountry,
  formatPhoneLocal,
  getFullPhoneDisplay,
  normalizePhoneDigits,
  COUNTRIES,
} from '@/utils/validation';
import { apiService, UserProfile, League } from '@/services';
import SoloRegistrationForm from './registration/SoloRegistrationForm';
import GroupRegistrationForm from './registration/GroupRegistrationForm';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistrationComplete?: () => void;
}

type RegistrationType = 'solo' | 'group';

const MIN_GROUP_SIZE = 1;

function getInitialGroup() {
  return Array.from({ length: MIN_GROUP_SIZE }, () => ({ firstName: '', lastName: '', email: '' }));
}

type EmailErrorType = string | { message: string; suggestion: string };

export default function RegistrationModal({ isOpen, onClose, onRegistrationComplete }: RegistrationModalProps) {
  const { user } = useUser();
  const { request: authenticatedRequest } = useAuthenticatedApi();
  const [type, setType] = useState<RegistrationType>('solo');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const selectedLeagueObj = leagues.find(l => l.id === selectedLeague) ?? null;
  const maxInvitees = selectedLeagueObj?.format === '7v7' ? 6 : 4;
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countryIso, setCountryIso] = useState('US');
  const [solo, setSolo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
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

  useEffect(() => {
    if (isOpen && user) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const leaguesData = await apiService.getPublicLeagues();
          setLeagues(leaguesData);
          if (leaguesData.length > 0) {
            setSelectedLeague(leaguesData[0].id);
          }

          const profile = await authenticatedRequest<UserProfile>('/user/me').catch((err: unknown) => {
            if (isHttpStatus(err, 404)) return null;
            throw err;
          });
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
        } catch (err) {
          logger.error('Failed to load registration data:', err);
          setError('Failed to load leagues. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await authenticatedRequest<{ isRegistered: boolean }>(`/user/profile/${user.id}/registered/${leagueId}`);
      setIsLeagueRegistered(result.isRegistered);
      if (result.isRegistered) {
        setError('You are already registered for this league. You cannot register twice.');
      } else {
        setError('');
      }
    } catch (err) {
      logger.error('Failed to check registration status:', err);
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
    setSolo(prev => ({
      ...prev,
      phone: prev.phone.slice(0, COUNTRIES.find(c => c.iso === newIso)?.digitCount ?? 15),
    }));
  };

  const handleAddPlayer = () => {
    if (group.length < maxInvitees) {
      setGroup([...group, { firstName: '', lastName: '', email: '' }]);
    }
  };

  const handleRemovePlayer = (idx: number) => {
    if (group.length > MIN_GROUP_SIZE) {
      setGroup(group.filter((_, i) => i !== idx));
    }
  };

  const getVisibleError = (field: string): string | EmailErrorType | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return fieldErrors[field];
  };

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
      } catch (err: unknown) {
        logger.error('Failed to register:', err);
        const msg = getApiErrorMessage(err);
        if (msg.includes('already registered')) {
          setError('You are already registered for this league.');
          setIsLeagueRegistered(true);
        } else {
          setError(msg);
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
      } catch (err: unknown) {
        logger.error('Failed to register group:', err);
        setError(getApiErrorMessage(err));
      }
    }
  };

  const missingFields = getMissingFields();
  const hasErrors = missingFields.length > 0;

  const phoneDisplayValue = formatPhoneLocal(solo.phone, countryIso);
  const phonePreview = getFullPhoneDisplay(solo.phone, countryIso);

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
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

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

        {selectedLeagueObj && !selectedLeagueObj.is_registration_open && (
          <div className="mb-5 border border-red-500/30 rounded-lg p-3 bg-red-500/10">
            <p className="text-red-400 text-sm font-medium">Registration is closed for this league.</p>
            {selectedLeagueObj.spots_remaining === 0 && (
              <p className="text-red-400/80 text-xs mt-1">This league is full — no spots remaining.</p>
            )}
          </div>
        )}

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
              <p>Groups of 2&ndash;{maxInvitees} players. May be combined with others to form complete teams.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'solo' ? (
            <SoloRegistrationForm
              solo={solo}
              countryIso={countryIso}
              fieldErrors={fieldErrors}
              touched={touched}
              submitAttempted={submitAttempted}
              phoneDisplayValue={phoneDisplayValue}
              phonePreview={phonePreview}
              missingFields={missingFields}
              hasErrors={hasErrors}
              isLeagueRegistered={isLeagueRegistered}
              userFirstName={user?.firstName}
              userLastName={user?.lastName}
              userEmail={user?.primaryEmailAddress?.emailAddress}
              onInput={handleInput}
              onBlur={handleBlur}
              onPhoneInput={handlePhoneInput}
              onCountryChange={handleCountryChange}
              onSoloChange={setSolo}
            />
          ) : (
            <GroupRegistrationForm
              groupName={groupName}
              group={group}
              maxInvitees={maxInvitees}
              fieldErrors={fieldErrors}
              touched={touched}
              submitAttempted={submitAttempted}
              onGroupNameChange={setGroupName}
              onInput={handleInput}
              onBlur={handleBlur}
              onAddPlayer={handleAddPlayer}
              onRemovePlayer={handleRemovePlayer}
              onGroupChange={setGroup}
            />
          )}

          {error && <div className="text-red-400 text-sm">{error}</div>}
          {success && <div className="text-green-400 text-sm">{success}</div>}

          <button
            type="submit"
            className="w-full bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            disabled={isLeagueRegistered || (selectedLeagueObj ? !selectedLeagueObj.is_registration_open : false)}
          >
            {isLeagueRegistered
              ? 'Already Registered'
              : selectedLeagueObj && !selectedLeagueObj.is_registration_open
              ? 'Registration Closed'
              : type === 'solo'
              ? 'Register'
              : 'Register Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
