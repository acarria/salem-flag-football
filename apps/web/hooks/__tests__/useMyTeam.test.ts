import { renderHook, waitFor } from '@testing-library/react';
import { useMyTeam } from '../useMyTeam';
import { useAuth } from '@clerk/nextjs';
import { server } from '../../__mocks__/server';
import { rest } from 'msw';

const mockUseAuth = useAuth as jest.Mock;

describe('useMyTeam', () => {
  test('returns null when not signed in', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, userId: null, isLoaded: true, getToken: jest.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useMyTeam());
    expect(result.current.teamId).toBeNull();
  });

  test('returns team_id when a registration has a team', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, userId: 'user123', isLoaded: true, getToken: jest.fn().mockResolvedValue('tok') });
    server.use(
      rest.get('http://localhost:8000/registration/player/user123/leagues', (_req, res, ctx) => {
        return res(ctx.json([{ league_id: 'league-1', team_id: 'team-abc' }]));
      })
    );
    const { result } = renderHook(() => useMyTeam());
    await waitFor(() => expect(result.current.teamId).toBe('team-abc'));
  });

  test('returns null when no registrations have teams', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, userId: 'user123', isLoaded: true, getToken: jest.fn().mockResolvedValue('tok') });
    server.use(
      rest.get('http://localhost:8000/registration/player/user123/leagues', (_req, res, ctx) => {
        return res(ctx.json([{ league_id: 'league-1', team_id: null }]));
      })
    );
    const { result } = renderHook(() => useMyTeam());
    await waitFor(() => {
      expect(result.current.teamId).toBeNull();
    });
  });

  test('returns null on API error', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, userId: 'user123', isLoaded: true, getToken: jest.fn().mockResolvedValue('tok') });
    server.use(
      rest.get('http://localhost:8000/registration/player/user123/leagues', (_req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ detail: 'Server error' }));
      })
    );
    const { result } = renderHook(() => useMyTeam());
    await waitFor(() => {
      expect(result.current.teamId).toBeNull();
    });
  });

  test('clears teamId when user signs out', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, userId: 'user123', isLoaded: true, getToken: jest.fn().mockResolvedValue('tok') });
    server.use(
      rest.get('http://localhost:8000/registration/player/user123/leagues', (_req, res, ctx) => {
        return res(ctx.json([{ league_id: 'league-1', team_id: 'team-xyz' }]));
      })
    );

    const { result, rerender } = renderHook(() => useMyTeam());
    await waitFor(() => expect(result.current.teamId).toBe('team-xyz'));

    mockUseAuth.mockReturnValue({ isSignedIn: false, userId: null, isLoaded: true, getToken: jest.fn().mockResolvedValue(null) });
    rerender();

    expect(result.current.teamId).toBeNull();
  });
});
