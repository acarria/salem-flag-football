import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import BaseLayout from '../components/layout/BaseLayout';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import { MyTeamResponse } from '../services';

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { isSignedIn, userId } = useAuth();
  const { request: authenticatedRequest } = useAuthenticatedApi();
  const [leagueId, setLeagueId] = useState<string | null>(null);

  // Try to find the league this team belongs to so we can show a back link
  useEffect(() => {
    if (!isSignedIn || !userId || !teamId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const registrations = await authenticatedRequest<{ league_id: string; team_id: string | null }[]>(
          `/registration/player/${userId}/leagues`
        );
        if (!cancelled) {
          const match = registrations.find(r => r.team_id === teamId);
          setLeagueId(match?.league_id ?? null);
        }
      } catch {
        // Non-fatal
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isSignedIn, userId, teamId, authenticatedRequest]);

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="section-label mb-3">TEAM</div>
        <h1 className="text-xl font-semibold text-white mb-3">Team pages coming soon</h1>
        <p className="text-sm text-[#6B6B6B] mb-8">
          Detailed team pages with stats, roster, and history are on the way.
        </p>
        {leagueId ? (
          <Link
            to={`/leagues/${leagueId}`}
            className="text-sm text-accent hover:underline"
          >
            ← Back to League
          </Link>
        ) : (
          <Link
            to="/leagues"
            className="text-sm text-accent hover:underline"
          >
            ← Back to Leagues
          </Link>
        )}
      </div>
    </BaseLayout>
  );
}
