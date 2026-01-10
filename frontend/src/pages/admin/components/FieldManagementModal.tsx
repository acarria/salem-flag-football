import React from 'react';
import { Field, FieldCreateRequest, FieldUpdateRequest, League } from '../../../services';

interface FieldManagementModalProps {
  league: League | null; // Optional - null for global field management
  fields: Field[];
  formData: Partial<FieldCreateRequest>;
  editingField: Field | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onEdit: (field: Field) => void;
  onDelete: (fieldId: number) => void;
  onCancel: () => void;
  onCancelEdit: () => void;
  isLoading: boolean;
}

export default function FieldManagementModal({
  league,
  fields,
  formData,
  editingField,
  onInputChange,
  onSubmit,
  onEdit,
  onDelete,
  onCancel,
  onCancelEdit,
  isLoading
}: FieldManagementModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-accent rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-accent">Manage Fields</h3>
            {league && <p className="text-sm text-gray-400 mt-1">League: {league.name}</p>}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        {/* Existing Fields List */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-accent mb-3">Existing Fields ({fields.length})</h4>
          {fields.length === 0 ? (
            <div className="text-center py-8 bg-black bg-opacity-30 rounded-lg">
              <p className="text-gray-400">No fields configured yet. Add your first field below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`bg-black bg-opacity-30 rounded-lg p-4 border ${
                    field.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-bold text-white text-lg">{field.name}</h5>
                        {field.field_number && (
                          <span className="text-sm text-gray-400">#{field.field_number}</span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            field.is_active
                              ? 'bg-green-900 text-green-200'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {field.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 space-y-1">
                        {field.facility_name && (
                          <div>
                            <span className="text-gray-400">Facility:</span> {field.facility_name}
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Address:</span>{' '}
                          {field.street_address}, {field.city}, {field.state} {field.zip_code}
                        </div>
                        {field.additional_notes && (
                          <div className="text-gray-400 italic">{field.additional_notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => onEdit(field)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(field.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Field Form */}
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-lg font-bold text-accent mb-4">
            {editingField ? 'Edit Field' : 'Add New Field'}
          </h4>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            console.log('Form submitted', { editingField, formData, onSubmit });
            onSubmit(); 
          }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Field Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={onInputChange}
                  required
                  className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g., Main Field, Field 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Field Number
                </label>
                <input
                  type="text"
                  name="field_number"
                  value={formData.field_number || ''}
                  onChange={onInputChange}
                  className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Optional field identifier"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Facility Name
              </label>
              <input
                type="text"
                name="facility_name"
                value={formData.facility_name || ''}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g., Salem Community Center"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                name="street_address"
                value={formData.street_address || ''}
                onChange={onInputChange}
                required
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={onInputChange}
                  required
                  className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Salem"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">State *</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={onInputChange}
                  required
                  className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="MA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ZIP Code *</label>
                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code || ''}
                  onChange={onInputChange}
                  required
                  className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="01970"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country || 'USA'}
                onChange={onInputChange}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="USA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Additional Notes
              </label>
              <textarea
                name="additional_notes"
                value={formData.additional_notes || ''}
                onChange={onInputChange}
                rows={3}
                className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Any additional information about this field location..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading || !formData.name || !formData.street_address || !formData.city || !formData.state || !formData.zip_code}
                className="px-6 py-2 bg-accent text-white font-bold rounded hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : editingField ? 'Update Field' : 'Add Field'}
              </button>
              {editingField && (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-6 py-2 border-2 border-accent text-accent font-bold rounded hover:bg-accent hover:text-white transition-colors"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 border-2 border-gray-600 text-gray-300 font-bold rounded hover:bg-gray-700 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

