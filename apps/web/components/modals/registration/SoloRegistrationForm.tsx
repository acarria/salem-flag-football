'use client';

import React from 'react';
import {
  getEmailError,
  getPhoneErrorForCountry,
  formatPhoneLocal,
  getFullPhoneDisplay,
  COUNTRIES,
} from '@/utils/validation';
import { inputCls, inputErrCls, labelCls } from '@/utils/formStyles';

type EmailErrorType = string | { message: string; suggestion: string };

interface SoloRegistrationFormProps {
  solo: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    gender: string;
    terms_accepted: boolean;
    communications_accepted: boolean;
  };
  countryIso: string;
  fieldErrors: { [key: string]: string | EmailErrorType };
  touched: { [key: string]: boolean };
  submitAttempted: boolean;
  phoneDisplayValue: string;
  phonePreview: string;
  missingFields: string[];
  hasErrors: boolean;
  isLeagueRegistered: boolean;
  userFirstName?: string | null;
  userLastName?: string | null;
  userEmail?: string | null;
  onInput: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (field: string) => void;
  onPhoneInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCountryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSoloChange: (updater: (prev: SoloRegistrationFormProps['solo']) => SoloRegistrationFormProps['solo']) => void;
}

export default function SoloRegistrationForm({
  solo,
  countryIso,
  fieldErrors,
  touched,
  submitAttempted,
  phoneDisplayValue,
  phonePreview,
  missingFields,
  hasErrors,
  isLeagueRegistered,
  userFirstName,
  userLastName,
  userEmail,
  onInput,
  onBlur,
  onPhoneInput,
  onCountryChange,
  onSoloChange,
}: SoloRegistrationFormProps) {
  const getVisibleError = (field: string): string | EmailErrorType | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return fieldErrors[field];
  };

  const selectedCountry = COUNTRIES.find(c => c.iso === countryIso)!;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="solo-first_name" className={labelCls}>First Name</label>
          <input
            id="solo-first_name"
            className={getVisibleError('first_name') ? inputErrCls : inputCls}
            name="first_name"
            placeholder="First"
            value={solo.first_name}
            onChange={onInput}
            onBlur={() => onBlur('first_name')}
            autoComplete="given-name"
            readOnly={!!userFirstName}
          />
          {getVisibleError('first_name') && (
            <p className="text-red-400 text-xs mt-1">{getVisibleError('first_name') as string}</p>
          )}
        </div>
        <div>
          <label htmlFor="solo-last_name" className={labelCls}>Last Name</label>
          <input
            id="solo-last_name"
            className={getVisibleError('last_name') ? inputErrCls : inputCls}
            name="last_name"
            placeholder="Last"
            value={solo.last_name}
            onChange={onInput}
            onBlur={() => onBlur('last_name')}
            autoComplete="family-name"
            readOnly={!!userLastName}
          />
          {getVisibleError('last_name') && (
            <p className="text-red-400 text-xs mt-1">{getVisibleError('last_name') as string}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="solo-email" className={labelCls}>Email</label>
        <input
          id="solo-email"
          className={getVisibleError('email') ? inputErrCls : inputCls}
          name="email"
          placeholder="you@example.com"
          value={solo.email}
          onChange={onInput}
          onBlur={() => onBlur('email')}
          autoComplete="email"
          type="email"
          readOnly={!!userEmail}
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
                  onClick={() => onSoloChange(prev => ({ ...prev, email: err.suggestion }))}
                >
                  Use suggestion
                </button>
              </p>
            );
          }
          return <p className="text-red-400 text-xs mt-1">{err as string}</p>;
        })()}
      </div>

      <div>
        <label htmlFor="solo-phone" className={labelCls}>Phone</label>
        <div className="flex gap-2">
          <select
            value={countryIso}
            onChange={onCountryChange}
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
            id="solo-phone"
            className={`flex-1 ${getVisibleError('phone') ? inputErrCls : inputCls}`}
            name="phone"
            placeholder={selectedCountry.format.replace(/X/g, '0')}
            value={phoneDisplayValue}
            onChange={onPhoneInput}
            onBlur={() => onBlur('phone')}
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

      <div>
        <label htmlFor="solo-date_of_birth" className={labelCls}>Date of Birth</label>
        <input
          id="solo-date_of_birth"
          className={getVisibleError('date_of_birth') ? inputErrCls : inputCls}
          name="date_of_birth"
          value={solo.date_of_birth}
          onChange={onInput}
          onBlur={() => onBlur('date_of_birth')}
          autoComplete="bday"
          type="date"
        />
        {getVisibleError('date_of_birth') && (
          <p className="text-red-400 text-xs mt-1">{getVisibleError('date_of_birth') as string}</p>
        )}
      </div>

      <div>
        <label htmlFor="solo-gender" className={labelCls}>Gender</label>
        <select
          id="solo-gender"
          className={getVisibleError('gender') ? inputErrCls : inputCls}
          name="gender"
          value={solo.gender}
          onChange={onInput}
          onBlur={() => onBlur('gender')}
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

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="terms_accepted"
            checked={solo.terms_accepted}
            onChange={onInput}
            onBlur={() => onBlur('terms_accepted')}
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
        {getVisibleError('terms_accepted') && (
          <p className="text-red-400 text-xs">{getVisibleError('terms_accepted') as string}</p>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="communications_accepted"
            checked={solo.communications_accepted}
            onChange={onInput}
            className="mt-0.5 w-4 h-4 rounded accent-accent flex-shrink-0"
          />
          <span className="text-xs text-[#A0A0A0] leading-relaxed">
            I consent to receive communications about league activities, schedules, and updates via email.
          </span>
        </label>
      </div>

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
  );
}
