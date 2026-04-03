'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import BaseLayout from '@/components/layout/BaseLayout';
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
import { UserProfile } from '@/services';
import { invitationService } from '@/services/public/invitations';
import { MyGroup } from '@salem/types';
import { inputCls, labelCls } from '@/utils/formStyles';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';

// Pre-sorted by dial code length (descending) to avoid false matches (e.g. +44 vs +4)
const COUNTRIES_BY_DIAL_LENGTH = [...COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

/**
 * Parses an international phone string (e.g. "+1 234-567-8910") into
 * { countryIso, localDigits }. Falls back to US if no match.
 */
function parseInternationalPhone(phone: string): { countryIso: string; localDigits: string } {
  if (!phone) return { countryIso: 'US', localDigits: '' };
  const digits = phone.replace(/\D/g, '');
  for (const c of COUNTRIES_BY_DIAL_LENGTH) {
    if (digits.startsWith(c.dialCode) && digits.length === c.dialCode.length + c.digitCount) {
      return { countryIso: c.iso, localDigits: digits.slice(c.dialCode.length) };
    }
  }
  return { countryIso: 'US', localDigits: digits };
}

export default function ProfilePage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { request } = useAuthenticatedApi();
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

  // Phone state: store local digits + country separately from the profile string
  const [countryIso, setCountryIso] = useState('US');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [originalCountryIso, setOriginalCountryIso] = useState('US');
  const [originalPhoneDigits, setOriginalPhoneDigits] = useState('');

  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  interface LeagueRegistration {
    id: string;
    league_id: string;
    league_name: string | null;
    waiver_status: string;
    registration_status: string;
    created_at: string;
  }
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          setIsLoading(true);
          setError('');

          const existingProfile = await request<UserProfile>('/user/me').catch((err: unknown) => {
            if (isHttpStatus(err, 404)) return null;
            throw err;
          });

          if (existingProfile) {
            setProfile(existingProfile);
            setOriginalProfile(existingProfile);
            const parsed = parseInternationalPhone(existingProfile.phone || '');
            setCountryIso(parsed.countryIso);
            setPhoneDigits(parsed.localDigits);
            setOriginalCountryIso(parsed.countryIso);
            setOriginalPhoneDigits(parsed.localDigits);
          } else {
            const defaultProfile: UserProfile = {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.primaryEmailAddress?.emailAddress || '',
              phone: '',
              dateOfBirth: '',
              gender: '',
              communicationsAccepted: false,
            };
            setProfile(defaultProfile);
            setOriginalProfile(defaultProfile);
          }
        } catch (err) {
          logger.error('Failed to fetch profile:', err);
          setError('Failed to load profile. Please try again.');

          const defaultProfile: UserProfile = {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.primaryEmailAddress?.emailAddress || '',
            phone: '',
            dateOfBirth: '',
            gender: '',
            communicationsAccepted: false,
          };
          setProfile(defaultProfile);
          setOriginalProfile(defaultProfile);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();
  }, [user, request]);

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

  useEffect(() => {
    const fetchRegistrations = async () => {
      if (!user?.id) return;
      try {
        const data = await request<LeagueRegistration[]>(`/registration/player/${user.id}/leagues`);
        setRegistrations(data);
      } catch {
        // Non-fatal
      }
    };
    fetchRegistrations();
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

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = normalizePhoneDigits(raw, countryIso);
    setPhoneDigits(digits);
    setFieldErrors(prev => {
      const { phone, ...rest } = prev;
      return rest;
    });
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIso = e.target.value;
    setCountryIso(newIso);
    setPhoneDigits(prev => prev.slice(0, COUNTRIES.find(c => c.iso === newIso)?.digitCount ?? 15));
    setFieldErrors(prev => {
      const { phone, ...rest } = prev;
      return rest;
    });
  };

  const selectedCountry = COUNTRIES.find(c => c.iso === countryIso)!;
  const phoneDisplayValue = formatPhoneLocal(phoneDigits, countryIso);
  const phonePreview = getFullPhoneDisplay(phoneDigits, countryIso);

  const handleSave = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    setError('');
    setSuccess('');
    setFieldErrors({});

    const errors: {
      email?: EmailErrorType;
      phone?: string;
      [key: string]: string | EmailErrorType | undefined;
    } = {};
    const emailError = getEmailError(profile.email);
    if (emailError) errors.email = emailError;
    const phoneError = getPhoneErrorForCountry(phoneDigits, countryIso);
    if (phoneError) errors.phone = phoneError;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the errors above.');
      setIsSaving(false);
      return;
    }

    try {
      const payload = {
        ...profile,
        phone: getFullPhoneDisplay(phoneDigits, countryIso),
      };
      const updatedProfile = await request<UserProfile>('/user/me', { method: 'PUT', body: JSON.stringify(payload) });
      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
      const parsed = parseInternationalPhone(updatedProfile.phone || '');
      setCountryIso(parsed.countryIso);
      setPhoneDigits(parsed.localDigits);
      setOriginalCountryIso(parsed.countryIso);
      setOriginalPhoneDigits(parsed.localDigits);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: unknown) {
      logger.error('Failed to save profile:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) {
      setProfile({ ...originalProfile });
    }
    setCountryIso(originalCountryIso);
    setPhoneDigits(originalPhoneDigits);
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
      const groups = await invitationService.getMyGroups(token);
      setMyGroups(groups);
      setSuccess('Invitation revoked.');
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke invitation.');
    }
  };

  const inputDisabledCls = 'w-full px-3 py-2 bg-[#1A1A1A] border border-white/5 text-[#A0A0A0] text-sm rounded-md outline-none cursor-default';

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
            <Link href="/" className="text-sm text-white underline hover:text-[#A0A0A0]">
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
                  setOriginalCountryIso(countryIso);
                  setOriginalPhoneDigits(phoneDigits);
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
            {isEditing ? (
              <>
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
                    className={`flex-1 ${fieldErrors.phone ? 'w-full px-3 py-2 bg-[#1E1E1E] border border-red-500/60 focus:border-red-500/80 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]' : inputCls}`}
                    name="phone"
                    placeholder={selectedCountry.format.replace(/X/g, '0')}
                    value={phoneDisplayValue}
                    onChange={handlePhoneInput}
                    autoComplete="tel-national"
                    type="tel"
                    inputMode="numeric"
                  />
                </div>
                {phoneDigits && (
                  <p className="text-[#6B6B6B] text-xs mt-1 pl-1">
                    International format: <span className="text-[#A0A0A0]">{phonePreview}</span>
                  </p>
                )}
              </>
            ) : (
              <input
                type="tel"
                name="phone"
                value={profile.phone || ''}
                disabled
                className={inputDisabledCls}
              />
            )}
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

        {registrations.filter(r => r.waiver_status === 'pending').length > 0 && (
          <div className="border-t border-white/5 mt-10 pt-8">
            <div className="section-label mb-4">PENDING WAIVERS</div>
            <div className="space-y-3">
              {registrations
                .filter(r => r.waiver_status === 'pending')
                .map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{r.league_name || 'League'}</div>
                      <div className="text-xs text-[#6B6B6B] mt-0.5">
                        Registered {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <Link
                      href={`/waiver/${r.league_id}`}
                      className="bg-accent text-white text-xs font-medium py-1.5 px-3 rounded-md hover:bg-accent-dark transition-colors flex-shrink-0"
                    >
                      Sign Waiver
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}

        {profile.registrationDate && (
          <div className="border-t border-white/5 mt-10 pt-8">
            <div className="section-label mb-4">LEAGUE INFORMATION</div>
            <div className="space-y-0">
              <div className="border-b border-white/5 py-3 flex justify-between items-center">
                <span className="text-xs text-[#A0A0A0]">Registration Date</span>
                <span className="text-sm text-white">
                  {new Date(profile.registrationDate).toLocaleDateString()}
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

        <div className="border-t border-white/5 mt-10 pt-8">
          <div className="section-label mb-4">MY GROUPS</div>
          {groupsLoading ? (
            <div className="text-sm text-[#6B6B6B]">Loading groups&#8230;</div>
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
                          {member.email && <span className="text-xs text-[#6B6B6B]">{member.email}</span>}
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

        <div className="border-t border-white/5 mt-10 pt-6">
          <div className="section-label mb-4">QUICK LINKS</div>
          <div className="flex flex-wrap gap-6">
            <Link href="/rules" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              League Rules <span>&#8594;</span>
            </Link>
            <Link href="/" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              Schedule <span>&#8594;</span>
            </Link>
            <Link href="/contact" className="text-sm text-[#A0A0A0] hover:text-white transition-colors flex items-center gap-1.5">
              Contact League <span>&#8594;</span>
            </Link>
          </div>
        </div>

      </div>
    </BaseLayout>
  );
}
