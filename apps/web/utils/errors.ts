/**
 * Standardized error handling utilities for API errors.
 *
 * Error objects thrown by useAuthenticatedApi and services/core/base.ts
 * have the shape: Error & { response?: { status, statusText, data: { detail? } } }
 */

interface ApiError {
  message?: string;
  response?: {
    status: number;
    statusText: string;
    data?: { detail?: string; message?: string };
  };
}

/** Extract a user-facing error message from an API error. */
export function getApiErrorMessage(err: unknown): string {
  const e = err as ApiError;
  return e?.response?.data?.detail || e?.message || 'An error occurred. Please try again.';
}

/** Check whether an error has a specific HTTP status code. */
export function isHttpStatus(err: unknown, status: number): boolean {
  return (err as ApiError)?.response?.status === status;
}
