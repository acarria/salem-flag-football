'use client';

import React, { useState, useEffect } from 'react';
import { PaginatedUserResponse } from '@/services';

interface UsersSectionProps {
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
}

export default function UsersSection({ authenticatedRequest }: UsersSectionProps) {
  const [usersData, setUsersData] = useState<PaginatedUserResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(25);

  useEffect(() => {
    loadUsers(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async (page: number) => {
    setIsLoadingUsers(true);
    try {
      const data = await authenticatedRequest<PaginatedUserResponse>(`/admin/users?page=${page}&page_size=${usersPageSize}`);
      setUsersData(data);
      setUsersPage(page);
    } catch { /* silent */ } finally { setIsLoadingUsers(false); }
  };

  return (
    <section id="users">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Users</h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">{usersData?.total ?? 0} registered</p>
        </div>
        <button
          onClick={() => loadUsers(usersPage)}
          className="text-[#6B6B6B] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
          title="Refresh"
        >
          &#8635;
        </button>
      </div>

      <div className="admin-surface overflow-hidden">
        {isLoadingUsers ? (
          <div className="py-12 text-center text-sm text-[#6B6B6B]">Loading users&#8230;</div>
        ) : usersData && usersData.users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Name', 'Email', 'Phone', 'Gender', 'Leagues', 'Joined'].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((u) => (
                    <tr key={u.clerk_user_id} className="admin-row">
                      <td className="py-2.5 px-3 text-sm text-white">{u.first_name} {u.last_name}</td>
                      <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.email}</td>
                      <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.phone || '\u2014'}</td>
                      <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.gender || '\u2014'}</td>
                      <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{u.leagues_count}</td>
                      <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">
                        {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usersData.total_pages > 1 && (
              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-[#6B6B6B]">
                  {(usersPage - 1) * usersPageSize + 1}&#8211;{Math.min(usersPage * usersPageSize, usersData.total)} of {usersData.total}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => loadUsers(usersPage - 1)}
                    disabled={usersPage === 1}
                    className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#6B6B6B]">Page {usersPage} of {usersData.total_pages}</span>
                  <button
                    onClick={() => loadUsers(usersPage + 1)}
                    disabled={usersPage === usersData.total_pages}
                    className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-sm text-[#6B6B6B]">No users found.</div>
        )}
      </div>
    </section>
  );
}
