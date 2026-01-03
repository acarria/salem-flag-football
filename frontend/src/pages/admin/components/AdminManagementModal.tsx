import React from 'react';
import { AdminConfig, AdminConfigCreateRequest } from '../../../services';

interface AdminManagementModalProps {
  admins: AdminConfig[];
  formData: Partial<AdminConfigCreateRequest>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  onRemove: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function AdminManagementModal({
  admins,
  formData,
  onInputChange,
  onSubmit,
  onRemove,
  onCancel,
  isLoading
}: AdminManagementModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-accent rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-accent">Manage Admin Users</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Current Admins */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-accent mb-3">Current Admins</h4>
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between bg-black bg-opacity-30 rounded p-3">
                <div>
                  <div className="font-semibold text-white">{admin.email}</div>
                  <div className="text-sm text-gray-400">Role: {admin.role}</div>
                </div>
                <button
                  onClick={() => onRemove(admin.email)}
                  disabled={admin.email === 'alexcarria1@gmail.com'}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Admin */}
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-lg font-bold text-accent mb-3">Add New Admin</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSubmit}
              disabled={isLoading || !formData.email}
              className="px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              Add Admin
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border-2 border-accent text-accent font-bold rounded hover:bg-accent hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

