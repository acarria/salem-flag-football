import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, SignIn } from '@clerk/clerk-react';
import { invitationService, InvitationDetail } from '../services/public/invitations';

const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const data = await invitationService.getInvitation(token);
        setInvitation(data);
      } catch (err: any) {
        setError(err.message || 'Invitation not found.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const authToken = await getToken();
      if (!authToken) throw new Error('Not authenticated');
      await invitationService.acceptInvitation(token, authToken);
      setDone('accepted');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      await invitationService.declineInvitation(token);
      setDone('declined');
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-accent text-xl">Loading...</div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary px-4">
        <div className="bg-secondary rounded-xl p-8 max-w-md w-full text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-accent text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary px-4">
        <div className="bg-secondary rounded-xl p-8 max-w-md w-full text-center">
          {done === 'accepted' ? (
            <>
              <div className="text-green-400 text-5xl mb-4">✓</div>
              <h2 className="text-accent text-2xl font-bold mb-2">You're in!</h2>
              <p className="text-gray-300">
                You've been added to <strong>{invitation?.group_name}</strong> for{' '}
                <strong>{invitation?.league_name}</strong>.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-accent text-2xl font-bold mb-2">Invitation Declined</h2>
              <p className="text-gray-300">You've declined the invitation.</p>
            </>
          )}
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2 bg-accent text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isExpiredOrUsed = invitation && invitation.status !== 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="bg-secondary rounded-xl p-8 max-w-md w-full">
        <h1 className="text-accent text-2xl font-bold mb-4 text-center">Group Invitation</h1>

        {invitation && (
          <div className="mb-6 space-y-2 text-gray-300">
            <p>
              <strong>{invitation.inviter_name}</strong> invited you to join{' '}
              <strong>{invitation.group_name}</strong> for the{' '}
              <strong>{invitation.league_name}</strong> league.
            </p>
            <p className="text-sm text-gray-400">
              Expires: {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
            {isExpiredOrUsed && (
              <p className="text-yellow-400 text-sm">
                This invitation is <strong>{invitation.status}</strong> and can no longer be
                accepted.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {!isExpiredOrUsed && (
          <>
            {!isSignedIn ? (
              <div>
                <p className="text-gray-300 mb-4 text-center text-sm">
                  Sign in to accept your invitation.
                </p>
                <SignIn routing="hash" />
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Accept'}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
