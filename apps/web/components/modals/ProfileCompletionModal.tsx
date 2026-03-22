'use client';

import React, { useState, useEffect } from 'react';
import {
  getEmailError,
  getPhoneErrorForCountry,
  formatPhoneLocal,
  getFullPhoneDisplay,
  normalizePhoneDigits,
  COUNTRIES,
  isValidEmail,
} from '@/utils/validation';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onComplete: (profileData: ProfileData) => void;
  onCancel: () => void; // Callback when user tries to cancel/close
  clerkUser?: any;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  termsAccepted: boolean;
  communicationsAccepted: boolean;
}

// Date of birth validation (must be 18+ years old)
function isValidDateOfBirth(dateOfBirth: string): string | null {
  if (!dateOfBirth) return 'Date of birth is required.';
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age < 18) return 'You must be at least 18 years old to register.';
  if (age > 100) return 'Please enter a valid date of birth.';
  return null;
}

export default function ProfileCompletionModal({ isOpen, onComplete, onCancel, clerkUser }: ProfileCompletionModalProps) {
  const [profileData, setProfileData] = useState<Omit<ProfileData, 'phone'> & { phone: string }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    termsAccepted: false,
    communicationsAccepted: false
  });
  const [countryIso, setCountryIso] = useState('US');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Pre-populate fields with Clerk user data
  useEffect(() => {
    if (clerkUser && isOpen) {
      setProfileData(prev => ({
        ...prev,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        email: clerkUser.primaryEmailAddress?.emailAddress || ''
      }));
    }
  }, [clerkUser, isOpen]);

  if (!isOpen) return null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFieldErrors({});
    setProfileData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = normalizePhoneDigits(raw, countryIso);
    setFieldErrors(prev => {
      const { phone, ...rest } = prev;
      return rest;
    });
    setProfileData(prev => ({ ...prev, phone: digits }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIso = e.target.value;
    setCountryIso(newIso);
    setFieldErrors(prev => {
      const { phone, ...rest } = prev;
      return rest;
    });
    setProfileData(prev => ({
      ...prev,
      phone: prev.phone.slice(0, COUNTRIES.find(c => c.iso === newIso)?.digitCount ?? 15),
    }));
  };

  const selectedCountry = COUNTRIES.find(c => c.iso === countryIso)!;
  const phoneDisplayValue = formatPhoneLocal(profileData.phone, countryIso);
  const phonePreview = getFullPhoneDisplay(profileData.phone, countryIso);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!profileData.firstName) errors.firstName = 'First name is required.';
    if (!profileData.lastName) errors.lastName = 'Last name is required.';

    const emailError = getEmailError(profileData.email);
    if (emailError) {
      errors.email = typeof emailError === 'string' ? emailError : emailError.message;
    }

    const phoneError = getPhoneErrorForCountry(profileData.phone, countryIso);
    if (phoneError) errors.phone = phoneError;

    const dobError = isValidDateOfBirth(profileData.dateOfBirth);
    if (!profileData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
    else if (dobError) errors.dateOfBirth = dobError;

    if (!profileData.gender) errors.gender = 'Gender is required.';
    if (!profileData.termsAccepted) errors.termsAccepted = 'You must accept the terms of service.';

    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    onComplete({
      ...profileData,
      phone: getFullPhoneDisplay(profileData.phone, countryIso),
    });
  };

  // Check if form is valid for submit button
  const isFormValid = () => {
    return profileData.firstName &&
           profileData.lastName &&
           isValidEmail(profileData.email) &&
           !getPhoneErrorForCountry(profileData.phone, countryIso) &&
           !isValidDateOfBirth(profileData.dateOfBirth) &&
           profileData.gender &&
           profileData.termsAccepted;
  };

  const inputCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const inputErrCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-red-500/60 focus:border-red-500/80 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const labelCls = 'block text-xs font-medium text-[#A0A0A0] mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-1">Complete Your Profile</h2>
          <p className="text-sm text-[#A0A0A0]">
            Please provide your personal information to continue using the league platform.
          </p>
          <p className="text-xs text-red-400 mt-2">
            This information is required to create your account. If you cancel, your session will be removed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name</label>
              <input
                className={fieldErrors.firstName ? inputErrCls : inputCls}
                name="firstName"
                placeholder="First"
                value={profileData.firstName}
                onChange={handleInput}
                autoComplete="given-name"
              />
              {fieldErrors.firstName && <div className="text-red-400 text-xs mt-1">{fieldErrors.firstName}</div>}
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input
                className={fieldErrors.lastName ? inputErrCls : inputCls}
                name="lastName"
                placeholder="Last"
                value={profileData.lastName}
                onChange={handleInput}
                autoComplete="family-name"
              />
              {fieldErrors.lastName && <div className="text-red-400 text-xs mt-1">{fieldErrors.lastName}</div>}
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input
              className={fieldErrors.email ? inputErrCls : inputCls}
              name="email"
              placeholder="you@example.com"
              value={profileData.email}
              onChange={handleInput}
              autoComplete="email"
              type="email"
            />
            {fieldErrors.email && <div className="text-red-400 text-xs mt-1">{fieldErrors.email}</div>}
          </div>

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
                className={`flex-1 ${fieldErrors.phone ? inputErrCls : inputCls}`}
                name="phone"
                placeholder={selectedCountry.format.replace(/X/g, '0')}
                value={phoneDisplayValue}
                onChange={handlePhoneInput}
                autoComplete="tel-national"
                type="tel"
                inputMode="numeric"
              />
            </div>
            {profileData.phone && (
              <p className="text-[#6B6B6B] text-xs mt-1 pl-1">
                International format: <span className="text-[#A0A0A0]">{phonePreview}</span>
              </p>
            )}
            {fieldErrors.phone && <div className="text-red-400 text-xs mt-1">{fieldErrors.phone}</div>}
          </div>

          <div>
            <label className={labelCls}>Date of Birth</label>
            <input
              className={fieldErrors.dateOfBirth ? inputErrCls : inputCls}
              name="dateOfBirth"
              value={profileData.dateOfBirth}
              onChange={handleInput}
              autoComplete="bday"
              type="date"
            />
            {fieldErrors.dateOfBirth && <div className="text-red-400 text-xs mt-1">{fieldErrors.dateOfBirth}</div>}
          </div>

          <div>
            <label className={labelCls}>Gender</label>
            <select
              className={fieldErrors.gender ? inputErrCls : inputCls}
              name="gender"
              value={profileData.gender}
              onChange={handleInput}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
            {fieldErrors.gender && <div className="text-red-400 text-xs mt-1">{fieldErrors.gender}</div>}
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={profileData.termsAccepted}
                onChange={handleInput}
                className="mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0"
              />
              <span className="text-xs text-[#A0A0A0] leading-relaxed">
                I agree to the <a href="/terms" className="text-white underline hover:text-[#A0A0A0]">Terms of Service</a> and acknowledge that by creating an account and providing my information, I am bound by these terms.
              </span>
            </label>
            {fieldErrors.termsAccepted && <div className="text-red-400 text-xs">{fieldErrors.termsAccepted}</div>}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="communicationsAccepted"
                checked={profileData.communicationsAccepted}
                onChange={handleInput}
                className="mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0"
              />
              <span className="text-xs text-[#A0A0A0] leading-relaxed">
                I consent to receive communications about league activities, schedules, and updates via email.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!isFormValid()}
            className="w-full bg-accent text-white text-sm font-medium py-2 px-5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
          >
            Complete Profile
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-sm text-[#6B6B6B] hover:text-red-400 transition-colors"
          >
            Cancel & Remove Session
          </button>
        </form>
      </div>
    </div>
  );
}
