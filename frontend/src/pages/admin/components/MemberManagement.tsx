import React, { useState, useEffect } from 'react';
import { LeagueMember, adminApi } from '../../../services';

interface MemberManagementProps {
  leagueId: number;
  leagueName: string;
  onClose: () => void;
}

export default function MemberManagement({ leagueId, leagueName, onClose }: MemberManagementProps) {
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);

  useEffect(() => {
    loadMembers();
  }, [leagueId]);

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const membersData = await adminApi.getLeagueMembers(leagueId);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError('Failed to load league members. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWaiverStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
        <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pumpkin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gunmetal border-2 border-pumpkin rounded-xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-pumpkin">Member Management - {leagueName}</h3>
          <button
            onClick={onClose}
            className="text-pumpkin hover:text-deeporange text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 text-red-200 rounded">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-white">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members List */}
          <div className="lg:col-span-2 bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-4">
              League Members ({members.length})
            </h4>
            
            {members.length === 0 ? (
              <div className="text-center text-gray-300 py-8">
                No members found for this league.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                      selectedMember?.id === member.id
                        ? 'border-pumpkin bg-pumpkin bg-opacity-20'
                        : 'border-gray-600 hover:border-pumpkin'
                    }`}
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-semibold text-white">
                          {member.first_name} {member.last_name}
                        </h5>
                        <p className="text-sm text-gray-300">{member.email}</p>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(member.registration_status)}`}>
                            {member.registration_status}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(member.payment_status)}`}>
                            {member.payment_status}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getWaiverStatusColor(member.waiver_status)}`}>
                            {member.waiver_status}
                          </span>
                        </div>
                        {member.group_name && (
                          <p className="text-xs text-gray-400 mt-1">Group: {member.group_name}</p>
                        )}
                        {member.team_name && (
                          <p className="text-xs text-gray-400">Team: {member.team_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Member Details */}
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pumpkin mb-4">Member Details</h4>
            {selectedMember ? (
              <div className="space-y-4">
                <div>
                  <h5 className="font-bold text-white text-lg">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </h5>
                  <p className="text-gray-300">{selectedMember.email}</p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-pumpkin font-semibold">Registration Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedMember.registration_status)}`}>
                      {selectedMember.registration_status}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-pumpkin font-semibold">Payment Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(selectedMember.payment_status)}`}>
                      {selectedMember.payment_status}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-pumpkin font-semibold">Waiver Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getWaiverStatusColor(selectedMember.waiver_status)}`}>
                      {selectedMember.waiver_status}
                    </span>
                  </div>
                  
                  {selectedMember.group_name && (
                    <div>
                      <span className="text-pumpkin font-semibold">Group:</span>
                      <span className="text-white ml-2">{selectedMember.group_name}</span>
                    </div>
                  )}
                  
                  {selectedMember.team_name && (
                    <div>
                      <span className="text-pumpkin font-semibold">Team:</span>
                      <span className="text-white ml-2">{selectedMember.team_name}</span>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-pumpkin font-semibold">Joined:</span>
                    <span className="text-white ml-2">
                      {new Date(selectedMember.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-300">
                Select a member to view details
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-pumpkin text-pumpkin rounded hover:bg-pumpkin hover:text-black transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
