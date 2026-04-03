'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import BaseLayout from '@/components/layout/BaseLayout';
import Button from '@/components/common/Button';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
import { inputCls, inputErrCls, labelCls } from '@/utils/formStyles';
import { getApiErrorMessage } from '@/utils/errors';

interface Waiver {
  id: string;
  version: string;
  content: string;
  created_at: string;
}

interface WaiverStatus {
  signed: boolean;
  signed_at: string | null;
  waiver_version: string | null;
  waiver_deadline: string | null;
}

interface WaiverSignResponse {
  signed_at: string;
  waiver_version: string;
}

export default function WaiverPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [waiver, setWaiver] = useState<Waiver | null>(null);
  const [status, setStatus] = useState<WaiverStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [successData, setSuccessData] = useState<WaiverSignResponse | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!leagueId) return;
    setIsLoading(true);
    try {
      const [waiverData, statusData] = await Promise.all([
        authenticatedRequest<Waiver>('/waiver/active'),
        authenticatedRequest<WaiverStatus>(`/waiver/status?league_id=${leagueId}`),
      ]);
      setWaiver(waiverData);
      setStatus(statusData);
    } catch (err) {
      setError('Failed to load waiver information.');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, authenticatedRequest]);

  useEffect(() => {
    if (!isSignedIn) return;
    loadData();
  }, [isSignedIn, loadData]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!fullName.trim() || !consentChecked || !waiver) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await authenticatedRequest<WaiverSignResponse>('/waiver/sign', {
        method: 'POST',
        body: JSON.stringify({
          waiver_id: waiver.id,
          league_id: leagueId,
          full_name_typed: fullName.trim(),
        }),
      });
      setSuccessData(result);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      if (msg.includes('already signed')) {
        setError('You have already signed the waiver for this league.');
      } else if (msg.includes('no longer active')) {
        setError('The waiver has been updated. Please refresh the page to see the latest version.');
      } else if (msg.includes('expired')) {
        setError('Your waiver signing period has expired. Please contact the league administrator.');
      } else {
        setError(msg || 'Failed to sign waiver. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deadlineStr = status?.waiver_deadline
    ? new Date(status.waiver_deadline).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  const isDeadlinePassed = status?.waiver_deadline
    ? new Date(status.waiver_deadline) < new Date()
    : false;

  if (isLoading) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-[#A0A0A0]">Loading waiver...</p>
        </div>
      </BaseLayout>
    );
  }

  // Already signed
  if (status?.signed || successData) {
    const signedAt = successData?.signed_at || status?.signed_at;
    const version = successData?.waiver_version || status?.waiver_version;
    return (
      <BaseLayout>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-[#1A1A1A] border border-green-500/30 rounded-lg p-8 text-center">
            <div className="text-green-400 text-4xl mb-4">&#10003;</div>
            <h2 className="text-xl font-semibold text-white mb-2">Waiver Signed</h2>
            <p className="text-[#A0A0A0] mb-4">
              You have successfully signed the liability waiver{version ? ` (${version})` : ''}.
            </p>
            {signedAt && (
              <p className="text-sm text-[#6B6B6B]">
                Signed on {new Date(signedAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
            {successData && (
              <p className="text-sm text-[#A0A0A0] mt-4">
                A confirmation email with a PDF copy has been sent to your email address.
              </p>
            )}
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => router.push(`/leagues/${leagueId}`)}
            >
              Back to League
            </Button>
          </div>
        </div>
      </BaseLayout>
    );
  }

  // Deadline passed
  if (isDeadlinePassed) {
    return (
      <BaseLayout>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-[#1A1A1A] border border-red-500/30 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Signing Period Expired</h2>
            <p className="text-[#A0A0A0]">
              The waiver signing deadline has passed. Please contact the league administrator.
            </p>
          </div>
        </div>
      </BaseLayout>
    );
  }

  const nameError = submitAttempted && !fullName.trim() ? 'Please type your full legal name' : '';

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Liability Waiver</h1>
        {deadlineStr && (
          <p className="text-sm text-[#A0A0A0] mb-6">
            You must sign this waiver by <span className="text-white font-medium">{deadlineStr}</span>
          </p>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Waiver content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 mb-6 max-h-[60vh] overflow-y-auto"
        >
          <pre className="whitespace-pre-wrap text-sm text-[#D0D0D0] font-sans leading-relaxed">
            {waiver?.content}
          </pre>
        </div>

        {!hasScrolledToBottom && (
          <p className="text-xs text-[#6B6B6B] mb-4 text-center">
            Please scroll to the bottom of the waiver to continue
          </p>
        )}

        {/* Signature form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls} htmlFor="fullName">
              Type your full legal name to sign
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full legal name"
              className={nameError ? inputErrCls : inputCls}
              disabled={!hasScrolledToBottom}
              maxLength={200}
            />
            {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#1E1E1E] text-accent focus:ring-accent"
            />
            <span className="text-sm text-[#A0A0A0]">
              I have read and agree to the terms above, and I consent to signing electronically
            </span>
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!hasScrolledToBottom || !fullName.trim() || !consentChecked || isSubmitting}
          >
            {isSubmitting ? 'Signing...' : 'Sign Waiver'}
          </Button>
        </form>
      </div>
    </BaseLayout>
  );
}
