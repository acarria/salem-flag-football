/**
 * Standardized error handling utilities for API errors.
 *
 * Error objects thrown by useAuthenticatedApi and services/core/base.ts
 * have the shape: Error & { response?: { status, statusText, data: { detail? } } }
 */

import { logger } from '@/utils/logger';

interface ApiError {
  message?: string;
  response?: {
    status: number;
    statusText: string;
    data?: { detail?: string; message?: string };
  };
}

export interface ApiErrorData {
  detail?: string | Array<{ msg: string }>;
  message?: string;
  [key: string]: unknown;
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

/**
 * Parse a non-ok HTTP response into a structured error message and data.
 * Handles JSON with detail (string or Pydantic validation array), message key, and plain text.
 */
export async function parseApiErrorResponse(
  response: Response
): Promise<{ errorMessage: string; errorData: ApiErrorData }> {
  let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
  let errorData: ApiErrorData = { detail: errorMessage };

  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      errorData = await response.json();
      if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e) => e.msg).join('; ');
      } else if (errorData.detail) {
        errorMessage = errorData.detail as string;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } else {
      const text = await response.text();
      if (text) {
        errorMessage = text;
        errorData = { detail: text };
      }
    }
  } catch (e) {
    logger.error('Failed to parse error response:', e);
  }

  return { errorMessage, errorData };
}

/**
 * Build and throw a typed API error with response metadata attached.
 */
export function throwApiError(
  errorMessage: string,
  status: number,
  statusText: string,
  errorData: ApiErrorData
): never {
  const error = new Error(errorMessage) as Error & {
    response?: { status: number; statusText: string; data: ApiErrorData };
  };
  error.response = { status, statusText, data: errorData };
  throw error;
}
