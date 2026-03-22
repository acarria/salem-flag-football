'use client';

import React, { useState, useEffect } from 'react';
import { Field, FieldCreateRequest, FieldAvailability, FieldAvailabilityCreateRequest } from '@/services';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { inputCls, selectCls } from './constants';

interface FieldsSectionProps {
  authenticatedRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function FieldsSection({ authenticatedRequest, setError, setSuccess }: FieldsSectionProps) {
  const [fields, setFields] = useState<Field[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldDraft, setFieldDraft] = useState<Partial<FieldCreateRequest>>({
    name: '', field_number: '', street_address: '', city: '',
    state: '', zip_code: '', country: 'USA', facility_name: '', additional_notes: '',
  });
  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null);
  const [isSavingField, setIsSavingField] = useState(false);
  const [expandedFieldAvail, setExpandedFieldAvail] = useState<string | null>(null);
  const [fieldAvailabilities, setFieldAvailabilities] = useState<Record<string, FieldAvailability[]>>({});
  const [isAddingAvail, setIsAddingAvail] = useState<string | null>(null);
  const [availDraft, setAvailDraft] = useState<Partial<FieldAvailabilityCreateRequest>>({
    is_recurring: false, start_time: '', end_time: '',
  });

  useEffect(() => {
    loadAllFields();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllFields = async () => {
    try {
      const data = await authenticatedRequest<Field[]>('/admin/fields');
      setFields(Array.isArray(data) ? data : []);
    } catch { setFields([]); }
  };

  const startEditField = (field: Field) => {
    setEditingFieldId(field.id);
    setFieldDraft({
      name: field.name, field_number: field.field_number || '',
      street_address: field.street_address, city: field.city,
      state: field.state, zip_code: field.zip_code,
      country: field.country, facility_name: field.facility_name || '',
      additional_notes: field.additional_notes || '',
    });
  };

  const handleSaveField = async (fieldId: string) => {
    setIsSavingField(true);
    try {
      await authenticatedRequest<Field>(`/admin/fields/${fieldId}`, { method: 'PUT', body: JSON.stringify(fieldDraft) });
      setSuccess('Field updated!');
      setEditingFieldId(null);
      resetFieldDraft();
      loadAllFields();
    } catch { setError('Failed to update field.'); } finally { setIsSavingField(false); }
  };

  const handleCreateField = async () => {
    if (!fieldDraft.name || !fieldDraft.street_address || !fieldDraft.city || !fieldDraft.state || !fieldDraft.zip_code) {
      setError('Fill in all required fields'); return;
    }
    setIsSavingField(true);
    try {
      await authenticatedRequest<Field>('/admin/fields', { method: 'POST', body: JSON.stringify(fieldDraft) });
      setSuccess('Field created!');
      setIsAddingField(false);
      resetFieldDraft();
      loadAllFields();
    } catch { setError('Failed to create field.'); } finally { setIsSavingField(false); }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      await authenticatedRequest(`/admin/fields/${fieldId}`, { method: 'DELETE' });
      setSuccess('Field deleted!');
      loadAllFields();
    } catch { setError('Failed to delete field.'); }
    setConfirmDeleteField(null);
  };

  const resetFieldDraft = () => setFieldDraft({
    name: '', field_number: '', street_address: '', city: '',
    state: '', zip_code: '', country: 'USA', facility_name: '', additional_notes: '',
  });

  const handleFieldDraftChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFieldDraft(prev => ({ ...prev, [name]: value }));
  };

  const loadFieldAvailability = async (fieldId: string) => {
    try {
      const data = await authenticatedRequest<FieldAvailability[]>(`/admin/fields/${fieldId}/availability`);
      setFieldAvailabilities(prev => ({ ...prev, [fieldId]: data }));
    } catch { /* silent */ }
  };

  const handleToggleAvailPanel = (fieldId: string) => {
    if (expandedFieldAvail === fieldId) {
      setExpandedFieldAvail(null);
    } else {
      setExpandedFieldAvail(fieldId);
      loadFieldAvailability(fieldId);
    }
    setIsAddingAvail(null);
    setAvailDraft({ is_recurring: false, start_time: '', end_time: '' });
  };

  const handleCreateAvailability = async (fieldId: string) => {
    try {
      await authenticatedRequest<FieldAvailability>(`/admin/fields/${fieldId}/availability`, {
        method: 'POST',
        body: JSON.stringify({ ...availDraft, field_id: fieldId }),
      });
      setSuccess('Availability added!');
      setIsAddingAvail(null);
      setAvailDraft({ is_recurring: false, start_time: '', end_time: '' });
      loadFieldAvailability(fieldId);
    } catch (e) {
      setError((e as Error).message || 'Failed to add availability.');
    }
  };

  const handleDeleteAvailability = async (fieldId: string, availId: string) => {
    try {
      await authenticatedRequest(`/admin/fields/${fieldId}/availability/${availId}`, { method: 'DELETE' });
      setSuccess('Availability removed!');
      loadFieldAvailability(fieldId);
    } catch { setError('Failed to remove availability.'); }
  };

  return (
    <>
      <section id="fields">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Fields</h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">{fields.length} configured</p>
          </div>
        </div>

        <div className="admin-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Field #', 'Facility', 'Address', 'City / State', 'Active'].map((h) => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 && !isAddingField && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-[#6B6B6B]">No fields yet.</td></tr>
                )}
                {fields.map((field) => {
                  const isEditing = editingFieldId === field.id;
                  return (
                    <React.Fragment key={field.id}>
                      <tr className={`admin-row ${isEditing ? 'bg-white/[0.04]' : ''}`}>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="name" value={fieldDraft.name || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-white font-medium">{field.name}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="field_number" value={fieldDraft.field_number || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.field_number || '\u2014'}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="facility_name" value={fieldDraft.facility_name || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.facility_name || '\u2014'}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing
                            ? <input name="street_address" value={fieldDraft.street_address || ''} onChange={handleFieldDraftChange} className={inputCls} />
                            : <span className="text-[#A0A0A0]">{field.street_address}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input name="city" value={fieldDraft.city || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="City" />
                              <input name="state" value={fieldDraft.state || ''} onChange={handleFieldDraftChange} className={inputCls + ' w-16'} placeholder="MA" />
                            </div>
                          ) : (
                            <span className="text-[#A0A0A0]">{field.city}, {field.state}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-sm">
                          <span className={`status-dot ${field.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveField(field.id)}
                                  disabled={isSavingField}
                                  className="text-xs text-accent hover:text-accent px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                  {isSavingField ? 'Saving\u2026' : 'Save'}
                                </button>
                                <button onClick={() => { setEditingFieldId(null); resetFieldDraft(); }} className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleToggleAvailPanel(field.id)}
                                  className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                                >
                                  Availability {expandedFieldAvail === field.id ? '\u25B2' : '\u25BC'}
                                </button>
                                <button
                                  onClick={() => startEditField(field)}
                                  disabled={!!editingFieldId || isAddingField}
                                  className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteField(field.id)}
                                  disabled={!!editingFieldId || isAddingField}
                                  className="text-xs text-[#A0A0A0] hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedFieldAvail === field.id && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-3">Availability Windows</div>
                            {(fieldAvailabilities[field.id] || []).length === 0 ? (
                              <div className="text-xs text-[#6B6B6B] mb-3">No availability windows configured.</div>
                            ) : (
                              <div className="space-y-1.5 mb-3">
                                {(fieldAvailabilities[field.id] || []).map((av) => (
                                  <div key={av.id} className="flex items-center justify-between text-xs bg-[#1A1A1A] rounded px-3 py-2">
                                    <span className="text-[#A0A0A0]">
                                      {av.is_recurring
                                        ? `Every ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][av.day_of_week ?? 0]} ${av.start_time}\u2013${av.end_time}`
                                        : `${av.custom_date} ${av.start_time}\u2013${av.end_time}`}
                                      {av.notes && <span className="text-[#6B6B6B] ml-2">({av.notes})</span>}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteAvailability(field.id, av.id)}
                                      className="text-[#6B6B6B] hover:text-red-400 transition-colors ml-4"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isAddingAvail === field.id ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                  <label className="text-xs text-[#6B6B6B] block mb-1">Type</label>
                                  <select
                                    value={availDraft.is_recurring ? 'recurring' : 'once'}
                                    onChange={(e) => setAvailDraft(prev => ({ ...prev, is_recurring: e.target.value === 'recurring' }))}
                                    className={selectCls}
                                  >
                                    <option value="once">One-time</option>
                                    <option value="recurring">Recurring</option>
                                  </select>
                                </div>
                                {availDraft.is_recurring ? (
                                  <div>
                                    <label className="text-xs text-[#6B6B6B] block mb-1">Day of Week</label>
                                    <select
                                      value={availDraft.day_of_week ?? ''}
                                      onChange={(e) => setAvailDraft(prev => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                                      className={selectCls}
                                    >
                                      <option value="">Select&#8230;</option>
                                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                                        <option key={i} value={i}>{d}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-xs text-[#6B6B6B] block mb-1">Date</label>
                                    <input
                                      type="date"
                                      value={(availDraft as any).custom_date || ''}
                                      onChange={(e) => setAvailDraft(prev => ({ ...prev, custom_date: e.target.value } as any))}
                                      className={inputCls}
                                    />
                                  </div>
                                )}
                                <div>
                                  <label className="text-xs text-[#6B6B6B] block mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={availDraft.start_time || ''}
                                    onChange={(e) => setAvailDraft(prev => ({ ...prev, start_time: e.target.value }))}
                                    className={inputCls}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-[#6B6B6B] block mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={availDraft.end_time || ''}
                                    onChange={(e) => setAvailDraft(prev => ({ ...prev, end_time: e.target.value }))}
                                    className={inputCls}
                                  />
                                </div>
                                {availDraft.is_recurring && (
                                  <div className="md:col-span-2">
                                    <label className="text-xs text-[#6B6B6B] block mb-1">Start From</label>
                                    <input
                                      type="date"
                                      value={(availDraft as any).recurrence_start_date || ''}
                                      onChange={(e) => setAvailDraft(prev => ({ ...prev, recurrence_start_date: e.target.value } as any))}
                                      className={inputCls}
                                    />
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <label className="text-xs text-[#6B6B6B] block mb-1">Notes (optional)</label>
                                  <input
                                    type="text"
                                    value={(availDraft as any).notes || ''}
                                    onChange={(e) => setAvailDraft(prev => ({ ...prev, notes: e.target.value } as any))}
                                    className={inputCls}
                                    placeholder="e.g. Field 1 only"
                                  />
                                </div>
                              </div>
                            ) : null}
                            <div className="flex gap-2">
                              {isAddingAvail === field.id ? (
                                <>
                                  <button
                                    onClick={() => handleCreateAvailability(field.id)}
                                    className="text-xs text-accent px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => { setIsAddingAvail(null); setAvailDraft({ is_recurring: false, start_time: '', end_time: '' }); }}
                                    className="text-xs text-[#A0A0A0] hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setIsAddingAvail(field.id)}
                                  className="text-xs text-[#6B6B6B] hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                  <span className="text-base leading-none">+</span> Add window
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {isAddingField && (
                  <tr className="bg-white/[0.04] border-b border-white/5">
                    <td className="py-2.5 px-3"><input name="name" value={fieldDraft.name || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Name *" /></td>
                    <td className="py-2.5 px-3"><input name="field_number" value={fieldDraft.field_number || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="#" /></td>
                    <td className="py-2.5 px-3"><input name="facility_name" value={fieldDraft.facility_name || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Facility" /></td>
                    <td className="py-2.5 px-3"><input name="street_address" value={fieldDraft.street_address || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="Address *" /></td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1">
                        <input name="city" value={fieldDraft.city || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="City *" />
                        <input name="state" value={fieldDraft.state || ''} onChange={handleFieldDraftChange} className={inputCls + ' w-16'} placeholder="MA *" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3"><input name="zip_code" value={fieldDraft.zip_code || ''} onChange={handleFieldDraftChange} className={inputCls} placeholder="ZIP *" /></td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={handleCreateField}
                          disabled={isSavingField}
                          className="text-xs text-accent px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          {isSavingField ? 'Saving\u2026' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setIsAddingField(false); resetFieldDraft(); }}
                          className="text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!isAddingField && (
            <div className="px-3 py-3 border-t border-white/5">
              <button
                onClick={() => { setIsAddingField(true); resetFieldDraft(); }}
                disabled={!!editingFieldId}
                className="text-xs text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span>
                <span>Add field</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={!!confirmDeleteField}
        title="Delete Field"
        message="Are you sure you want to delete this field? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDeleteField && handleDeleteField(confirmDeleteField)}
        onCancel={() => setConfirmDeleteField(null)}
      />
    </>
  );
}
