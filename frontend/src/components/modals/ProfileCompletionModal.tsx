import React, { useState, useEffect } from 'react';

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

// Email validation with typo check
const COMMON_EMAIL_TYPOS = [
  'gmal.com', 'gmial.com', 'gmaill.com', 'gmail.con', 'gmail.co', 'gmail.cmo',
  'yaho.com', 'yahoo.con', 'yahoo.cmo', 'hotmial.com', 'hotmil.com', 'hotmail.con', 'hotmail.cmo',
  'outlok.com', 'outlook.con', 'outlook.cmo', 'icloud.con', 'icloud.cmo',
  'google.con', 'google.cmo',
];

function isValidEmail(email: string): string | null {
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) return 'Invalid email format.';
  const domain = email.split('@')[1]?.toLowerCase() || '';
  for (const typo of COMMON_EMAIL_TYPOS) {
    if (domain.endsWith(typo)) {
      return `Did you mean ${domain.replace(typo, typo.replace('con', 'com'))}?`;
    }
  }
  return null;
}

// US phone validation (accepts (xxx) xxx-xxxx, xxx-xxx-xxxx, xxxxxxxxxx, +1xxxxxxxxxx)
function isValidUSPhone(phone: string): string | null {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    // Remove leading 1
    phone = digits.slice(1);
  } else if (digits.length === 10) {
    phone = digits;
  } else {
    return 'Phone must be a valid US number (10 digits).';
  }
  // Area code cannot start with 0 or 1
  if (/^[01]/.test(phone)) return 'Area code cannot start with 0 or 1.';
  return null;
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
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    termsAccepted: false,
    communicationsAccepted: false
  });
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

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    
    if (!profileData.firstName) errors.firstName = 'First name is required.';
    if (!profileData.lastName) errors.lastName = 'Last name is required.';
    
    const emailError = isValidEmail(profileData.email);
    if (!profileData.email) errors.email = 'Email is required.';
    else if (emailError) errors.email = emailError;
    
    const phoneError = isValidUSPhone(profileData.phone);
    if (!profileData.phone) errors.phone = 'Phone is required.';
    else if (phoneError) errors.phone = phoneError;
    
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
    
    onComplete(profileData);
  };

  // Check if form is valid for submit button
  const isFormValid = () => {
    return profileData.firstName && 
           profileData.lastName && 
           profileData.email && 
           profileData.phone && 
           profileData.dateOfBirth && 
           profileData.gender && 
           profileData.termsAccepted &&
           !isValidEmail(profileData.email) &&
           !isValidUSPhone(profileData.phone) &&
           !isValidDateOfBirth(profileData.dateOfBirth);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <h2 className="text-2xl font-bold text-pumpkin mb-4 text-center">Complete Your Profile</h2>
        <p className="text-gray-300 text-sm mb-6 text-center">
          Please provide your personal information to continue using the league platform.
        </p>
        <p className="text-red-400 text-sm mb-6 text-center">
          ⚠️ This information is required to create your account. If you cancel, your session will be removed.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.firstName ? 'border-red-500' : ''}`}
              name="firstName"
              placeholder="First Name"
              value={profileData.firstName}
              onChange={handleInput}
              autoComplete="given-name"
            />
            <input
              className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.lastName ? 'border-red-500' : ''}`}
              name="lastName"
              placeholder="Last Name"
              value={profileData.lastName}
              onChange={handleInput}
              autoComplete="family-name"
            />
          </div>
          {fieldErrors.firstName && <div className="text-red-400 text-xs">{fieldErrors.firstName}</div>}
          {fieldErrors.lastName && <div className="text-red-400 text-xs">{fieldErrors.lastName}</div>}
          
          <input
            className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.email ? 'border-red-500' : ''}`}
            name="email"
            placeholder="Email"
            value={profileData.email}
            onChange={handleInput}
            autoComplete="email"
            type="email"
          />
          {fieldErrors.email && <div className="text-red-400 text-xs">{fieldErrors.email}</div>}
          
          <input
            className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.phone ? 'border-red-500' : ''}`}
            name="phone"
            placeholder="Phone"
            value={profileData.phone}
            onChange={handleInput}
            autoComplete="tel"
            type="tel"
          />
          {fieldErrors.phone && <div className="text-red-400 text-xs">{fieldErrors.phone}</div>}
          
          <input
            className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.dateOfBirth ? 'border-red-500' : ''}`}
            name="dateOfBirth"
            placeholder="Date of Birth"
            value={profileData.dateOfBirth}
            onChange={handleInput}
            autoComplete="bday"
            type="date"
          />
          {fieldErrors.dateOfBirth && <div className="text-red-400 text-xs">{fieldErrors.dateOfBirth}</div>}
          
          <select
            className={`w-full p-2 rounded bg-black border border-pumpkin text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pumpkin ${fieldErrors.gender ? 'border-red-500' : ''}`}
            name="gender"
            value={profileData.gender}
            onChange={handleInput}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          {fieldErrors.gender && <div className="text-red-400 text-xs">{fieldErrors.gender}</div>}
          
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={profileData.termsAccepted}
                onChange={handleInput}
                className="mt-1 w-4 h-4 text-pumpkin bg-black border-pumpkin rounded focus:ring-pumpkin focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                I agree to the <a href="/terms" className="text-pumpkin hover:text-deeporange underline">Terms of Service</a> and acknowledge that by creating an account and providing my information, I am bound by these terms.
              </span>
            </label>
            {fieldErrors.termsAccepted && <div className="text-red-400 text-xs">{fieldErrors.termsAccepted}</div>}
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="communicationsAccepted"
                checked={profileData.communicationsAccepted}
                onChange={handleInput}
                className="mt-1 w-4 h-4 text-pumpkin bg-black border-pumpkin rounded focus:ring-pumpkin focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                I consent to receive communications about league activities, schedules, and updates via email.
              </span>
            </label>
          </div>
          
          <button
            type="submit"
            disabled={!isFormValid()}
            className={`w-full py-3 rounded font-bold transition-colors mt-4 ${
              isFormValid() 
                ? 'bg-pumpkin text-black hover:bg-deeporange' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Complete Profile
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 rounded font-bold border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors mt-2"
          >
            Cancel & Remove Session
          </button>
        </form>
      </div>
    </div>
  );
} 