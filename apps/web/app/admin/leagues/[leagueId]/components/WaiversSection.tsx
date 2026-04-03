'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface WaiverSignature {
  id: string;
  player_name: string;
  player_email: string;
  waiver_version: string;
  signed_at: string;
  pdf_url: string | null;
}

interface WaiversSectionProps {
  leagueId: string;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  totalMembers: number;
}

export default function WaiversSection({
  leagueId,
  authenticatedRequest,
  totalMembers,
}: WaiversSectionProps) {
  const [signatures, setSignatures] = useState<WaiverSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnsigned, setShowUnsigned] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await authenticatedRequest<WaiverSignature[]>(
        `/admin/waivers?league_id=${leagueId}`
      );
      setSignatures(data);
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, authenticatedRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const signedCount = signatures.length;
  const unsignedCount = totalMembers - signedCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-white">
          Waivers{' '}
          <span className="text-[#6B6B6B] font-normal ml-1">
            ({signedCount}/{totalMembers} signed)
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {unsignedCount > 0 && (
            <button
              onClick={() => setShowUnsigned(!showUnsigned)}
              className="text-xs text-[#6B6B6B] hover:text-white transition-colors"
            >
              {showUnsigned ? 'Show signed' : `Show ${unsignedCount} unsigned`}
            </button>
          )}
          <button
            onClick={load}
            className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
            title="Refresh"
          >
            &#8635;
          </button>
        </div>
      </div>

      <div className="admin-surface overflow-hidden">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-[#6B6B6B]">Loading...</div>
        ) : signatures.length === 0 && !showUnsigned ? (
          <div className="py-10 text-center text-sm text-[#6B6B6B]">
            No waivers signed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Email', 'Version', 'Signed At', 'PDF'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signatures.map((sig) => (
                  <tr key={sig.id} className="admin-row">
                    <td className="py-2.5 px-3 text-sm text-white">{sig.player_name}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{sig.player_email}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{sig.waiver_version}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">
                      {new Date(sig.signed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-sm">
                      {sig.pdf_url ? (
                        <a
                          href={sig.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accent-dark transition-colors"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-[#6B6B6B]">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
