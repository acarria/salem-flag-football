import React, { useState, useEffect } from 'react';
import { Field, League } from '../../../services';

interface LeagueFieldAssociationModalProps {
  league: League;
  associatedFields: Field[]; // Fields currently associated with the league
  allFields: Field[]; // All available fields
  onAssociate: (fieldId: string) => void;
  onDisassociate: (fieldId: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function LeagueFieldAssociationModal({
  league,
  associatedFields,
  allFields,
  onAssociate,
  onDisassociate,
  onCancel,
  isLoading
}: LeagueFieldAssociationModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Get fields that are NOT associated with this league
  const unassociatedFields = allFields.filter(
    field => !associatedFields.some(af => af.id === field.id) && field.is_active
  );

  // Filter fields by search term
  const filteredAssociated = associatedFields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (field.facility_name && field.facility_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUnassociated = unassociatedFields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (field.facility_name && field.facility_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gunmetal border-2 border-accent rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-accent">Manage Fields for League</h3>
            <p className="text-sm text-gray-400 mt-1">{league.name}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search fields by name, city, or facility..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded bg-black border border-accent text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Associated Fields */}
          <div>
            <h4 className="text-lg font-bold text-accent mb-4">
              Associated Fields ({associatedFields.length})
            </h4>
            {filteredAssociated.length === 0 ? (
              <div className="text-center py-8 bg-black bg-opacity-30 rounded-lg">
                <p className="text-gray-400">
                  {associatedFields.length === 0 
                    ? 'No fields associated with this league yet.'
                    : 'No fields match your search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssociated.map((field) => (
                  <div
                    key={field.id}
                    className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h5 className="font-bold text-white text-lg">{field.name}</h5>
                          {field.field_number && (
                            <span className="text-sm text-gray-400">#{field.field_number}</span>
                          )}
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
                        </div>
                      </div>
                      <button
                        onClick={() => onDisassociate(field.id)}
                        disabled={isLoading}
                        className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Fields */}
          <div>
            <h4 className="text-lg font-bold text-accent mb-4">
              Available Fields ({unassociatedFields.length})
            </h4>
            {filteredUnassociated.length === 0 ? (
              <div className="text-center py-8 bg-black bg-opacity-30 rounded-lg">
                <p className="text-gray-400">
                  {unassociatedFields.length === 0 
                    ? 'All fields are associated with this league.'
                    : 'No fields match your search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUnassociated.map((field) => (
                  <div
                    key={field.id}
                    className="bg-black bg-opacity-30 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h5 className="font-bold text-white text-lg">{field.name}</h5>
                          {field.field_number && (
                            <span className="text-sm text-gray-400">#{field.field_number}</span>
                          )}
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
                        </div>
                      </div>
                      <button
                        onClick={() => onAssociate(field.id)}
                        disabled={isLoading}
                        className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-6 py-2 border-2 border-gray-600 text-gray-300 font-bold rounded hover:bg-gray-700 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

