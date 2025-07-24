import React from 'react';
import { AdminConfig, AdminConfigCreateRequest } from '../../../types';

interface AdminManagementProps {
  admins: AdminConfig[];
  formData: Partial<AdminConfigCreateRequest>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  onRemove: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function AdminManagement({
  admins,
  formData,
  onInputChange,
  onSubmit,
  onRemove,
  onCancel,
  isLoading,
}: AdminManagementProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Admin Management</h2>
      </div>

      {/* Add Admin Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Add New Admin</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role || 'admin'}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pumpkin focus:border-transparent"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onSubmit}
            disabled={isLoading || !formData.email}
            className="px-4 py-2 bg-pumpkin text-black font-bold rounded hover:bg-deeporange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding...' : 'Add Admin'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white font-bold rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Admins List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Current Admins</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {admins.map((admin) => (
            <div key={admin.id} className="px-6 py-4 flex justify-between items-center">
              <div>
                <div className="font-medium text-gray-900">{admin.email}</div>
                <div className="text-sm text-gray-500">
                  Role: {admin.role.replace('_', ' ')} • 
                  Status: {admin.is_active ? 'Active' : 'Inactive'} • 
                  Added: {new Date(admin.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => onRemove(admin.email)}
                disabled={admin.role === 'super_admin'}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={admin.role === 'super_admin' ? 'Cannot remove super admin' : 'Remove admin'}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {admins.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No admins found. Add your first admin to get started!
          </div>
        )}
      </div>
    </div>
  );
} 