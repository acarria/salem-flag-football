'use client';

import React, { useEffect, useState } from 'react';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';
import type { SignedWaiverDetail } from '@/services/public/waiver';

interface WaiverViewModalProps {
  signatureId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WaiverViewModal({ signatureId, isOpen, onClose }: WaiverViewModalProps) {
  const { request } = useAuthenticatedApi();
  const [detail, setDetail] = useState<SignedWaiverDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !signatureId) {
      setDetail(null);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    request<SignedWaiverDetail>(`/waiver/my-signatures/${signatureId}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load waiver details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, signatureId, request]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!signatureId) return;
    setDownloading(true);
    try {
      const data = await request<{ url: string }>(`/waiver/my-signatures/${signatureId}/pdf`);
      window.open(data.url, '_blank');
    } catch {
      setError('PDF download is not available.');
    } finally {
      setDownloading(false);
    }
  };

  const signedDate = detail?.signed_at
    ? new Date(detail.signed_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-white/10 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Liability Waiver</h2>
            {detail && (
              <p className="text-xs text-[#6B6B6B] mt-1">
                {detail.league_name} &middot; {detail.waiver_version}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#6B6B6B] hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {detail && !loading && (
            <>
              <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-6 mb-6">
                <pre className="whitespace-pre-wrap text-sm text-[#D0D0D0] font-sans leading-relaxed">
                  {detail.waiver_content}
                </pre>
              </div>

              <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Electronic Signature</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6B6B6B]">Signed by</span>
                    <span className="text-white">{detail.full_name_typed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B6B6B]">Date</span>
                    <span className="text-white">{signedDate}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          {detail?.has_pdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-4 py-2 text-sm font-medium bg-white/5 text-white border border-white/10 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {downloading ? 'Preparing...' : 'Download PDF'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-white/5 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
