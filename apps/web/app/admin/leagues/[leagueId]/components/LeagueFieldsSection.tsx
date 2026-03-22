'use client';

import React from 'react';
import { Field } from '@/services';

interface LeagueFieldsSectionProps {
  fields: Field[];
  allFields: Field[];
  leagueId: string;
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  onRefresh: (fields: Field[], allFields: Field[]) => void;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function LeagueFieldsSection({
  fields,
  allFields,
  leagueId,
  authenticatedRequest,
  onRefresh,
  setError,
  setSuccess,
}: LeagueFieldsSectionProps) {
  const unassociatedFields = allFields.filter(
    (f) => !fields.some((af) => af.id === f.id) && f.is_active
  );

  const handleAssociate = async (fieldId: string) => {
    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, { method: 'POST' });
      setSuccess('Field added!');
      const [f, af] = await Promise.all([
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
      ]);
      onRefresh(f, af);
    } catch (err: any) {
      setError(err.message || 'Failed to associate field.');
    }
  };

  const handleDisassociate = async (fieldId: string) => {
    try {
      await authenticatedRequest<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, { method: 'DELETE' });
      setSuccess('Field removed!');
      const [f, af] = await Promise.all([
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
      ]);
      onRefresh(f, af);
    } catch (err: any) {
      setError(err.message || 'Failed to disassociate field.');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white">Fields <span className="text-[#6B6B6B] font-normal ml-1">({fields.length})</span></h2>
      </div>

      <div className="admin-surface overflow-hidden mb-4">
        {fields.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#6B6B6B]">No fields associated yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Name', 'Field #', 'Facility', 'Address'].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">{h}</th>
                ))}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="admin-row">
                  <td className="py-2.5 px-3 text-sm text-white">{field.name}</td>
                  <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.field_number || '\u2014'}</td>
                  <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.facility_name || '\u2014'}</td>
                  <td className="py-2.5 px-3 text-sm text-[#A0A0A0]">{field.street_address}, {field.city}, {field.state}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => handleDisassociate(field.id)}
                      className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {unassociatedFields.length > 0 && (
        <div>
          <div className="section-label mb-3">Available to add</div>
          <div className="flex flex-wrap gap-2">
            {unassociatedFields.map((field) => (
              <button
                key={field.id}
                onClick={() => handleAssociate(field.id)}
                className="text-xs border border-white/10 hover:border-accent/40 text-[#A0A0A0] hover:text-white rounded-full px-3 py-1.5 transition-colors"
              >
                + {field.name}{field.field_number ? ` #${field.field_number}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
