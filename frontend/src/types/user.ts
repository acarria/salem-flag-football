import { RegistrationStatus, PaymentStatus, WaiverStatus } from './common';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  communicationsAccepted: boolean;
  registrationStatus: RegistrationStatus;
  teamId?: number;
  groupName?: string;
  registrationDate?: string;
  paymentStatus?: PaymentStatus;
  waiverStatus?: WaiverStatus;
  leagueId?: number;
}

export interface RegistrationData {
  type: 'solo' | 'group';
  solo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    termsAccepted: boolean;
    communicationsAccepted: boolean;
  };
  group?: {
    name: string;
    players: Array<{
      firstName: string;
      lastName: string;
      email: string;
    }>;
  };
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  termsAccepted: boolean;
  communicationsAccepted: boolean;
} 