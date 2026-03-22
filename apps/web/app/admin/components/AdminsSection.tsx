'use client';

import React, { useState, useEffect } from 'react';
import { AdminConfig, AdminConfigCreateRequest } from '@/services';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { inputCls, selectCls } from './constants';

interface AdminsSectionProps {
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  currentUserEmail: string | undefined;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function AdminsSection({ authenticatedRequest, currentUserEmail, setError, setSuccess }: AdminsSectionProps) {
  const [admins, setAdmins] = useState<AdminConfig[]>([]);
  const [adminFormData, setAdminFormData] = useState<Partial<AdminConfigCreateRequest>>({ email: '', role: 'admin' });
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<string | null>(null);

  useEffect(() => {
    loadAdmins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAdmins = async () => {
    try {
      const data = await authenticatedRequest<AdminConfig[]>('/admin/admins');
      setAdmins(data);
    } catch (err) { console.error('Failed to load admins:', err); }
  };

  const handleAddAdmin = async () => {
    if (!adminFormData.email) { setError('Email is required'); return; }
    try {
      await authenticatedRequest<AdminConfig>('/admin/admins', { method: 'POST', body: JSON.stringify(adminFormData) });
      setSuccess('Admin added!');
      setAdminFormData({ email: '', role: 'admin' });
      loadAdmins();
    } catch (err) { console.error('Failed to add admin:', err); setError('Failed to add admin.'); }
  };

  const handleRemoveAdmin = async (email: string) => {
    try {
      await authenticatedRequest(`/admin/admins/${email}`, { method: 'DELETE' });
      setSuccess('Admin removed!');
      loadAdmins();
    } catch (err) { console.error('Failed to remove admin:', err); setError('Failed to remove admin.'); }
    setConfirmRemoveAdmin(null);
  };

  return (
    <>
      <section id="admins">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Admins</h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">{admins.length} configured</p>
        </div>

        <div className="admin-surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Email</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Role</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="admin-row">
                  <td className="py-3 px-4 text-sm text-white">{admin.email}</td>
                  <td className="py-3 px-4 text-sm text-[#A0A0A0]">{admin.role}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setConfirmRemoveAdmin(admin.email)}
                      disabled={admin.email === currentUserEmail}
                      className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-4 border-t border-white/5">
            <div className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-3">Add Admin</div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <input
                  type="email"
                  name="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@example.com"
                  className={inputCls}
                />
              </div>
              <div className="w-40">
                <select
                  name="role"
                  value={adminFormData.role}
                  onChange={(e) => setAdminFormData(prev => ({ ...prev, role: e.target.value as any }))}
                  className={selectCls}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button
                onClick={handleAddAdmin}
                disabled={!adminFormData.email}
                className="text-sm font-medium bg-accent text-white px-3.5 py-1.5 rounded-md hover:bg-accent-dark transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={!!confirmRemoveAdmin}
        title="Remove Admin"
        message="Are you sure you want to remove this admin?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => confirmRemoveAdmin && handleRemoveAdmin(confirmRemoveAdmin)}
        onCancel={() => setConfirmRemoveAdmin(null)}
      />
    </>
  );
}
