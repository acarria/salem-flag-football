'use client';

import React from 'react';
import { LeagueMember } from '@/services';

interface MembersSectionProps {
  members: LeagueMember[];
  leagueId: string;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  onRefresh: (members: LeagueMember[]) => void;
}

export default function MembersSection({
  members,
  leagueId,
  authenticatedRequest,
  onRefresh,
}: MembersSectionProps) {
  const handleRefresh = async () => {
    try {
      const data = await authenticatedRequest<LeagueMember[]>(`/admin/leagues/${leagueId}/members`);
      onRefresh(data);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-white">Members <span className="text-[#6B6B6B] font-normal ml-1">({members.length})</span></h2>
        <button
          onClick={handleRefresh}
          className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
          title="Refresh"
        >
          &#8635;
        </button>
      </div>

      <div className="admin-surface overflow-hidden">
        {members.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#6B6B6B]">No members registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Email', 'Team', 'Group', 'Status', 'Payment', 'Waiver'].map((h) => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="admin-row">
                    <td className="py-2.5 px-3 text-sm text-white">{m.first_name} {m.last_name}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.email}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.team_name || '\u2014'}</td>
                    <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{m.group_name || '\u2014'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${m.registration_status === 'confirmed' ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                        <span className="text-xs text-[#A0A0A0]">{m.registration_status}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${m.payment_status === 'paid' ? 'bg-accent' : m.payment_status === 'pending' ? 'bg-yellow-500' : 'bg-[#6B6B6B]'}`} />
                        <span className="text-xs text-[#A0A0A0]">{m.payment_status}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${m.waiver_status === 'signed' ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                        <span className="text-xs text-[#A0A0A0]">{m.waiver_status}</span>
                      </div>
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
