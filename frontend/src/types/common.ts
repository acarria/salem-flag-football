// Common types used across the application

export type TournamentFormat = 'round_robin' | 'swiss' | 'playoff_bracket' | 'compass_draw';
export type GameFormat = '7v7' | '5v5' | '4v4' | '3v3';
export type RegistrationStatus = 'registered' | 'pending' | 'not_registered';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type WaiverStatus = 'pending' | 'signed' | 'expired';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 