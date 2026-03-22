'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useAuthenticatedApi } from './useAuthenticatedApi';

interface RegistrationSummary {
  league_id: string;
  team_id: string | null;
}

export function useMyTeam(): { teamId: string | null } {
  const { isSignedIn, userId } = useAuth();
  const { request } = useAuthenticatedApi();
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setTeamId(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const registrations = await request<RegistrationSummary[]>(
          `/registration/player/${userId}/leagues`
        );
        if (cancelled) return;
        const withTeam = registrations.find(r => r.team_id != null);
        setTeamId(withTeam?.team_id ?? null);
      } catch (err) {
        console.error('Failed to fetch team:', err);
        if (!cancelled) setTeamId(null);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isSignedIn, userId, request]);

  return { teamId };
}
