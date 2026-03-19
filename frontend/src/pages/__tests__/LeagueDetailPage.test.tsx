import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import LeagueDetailPage from '../LeagueDetailPage';
import { useAuth, useUser } from '@clerk/clerk-react';
import { server } from '../../__mocks__/server';
import { rest } from 'msw';

// Stable mock function — must be defined outside jest.mock() factory to remain stable across renders
const mockGetAuthToken = jest.fn().mockResolvedValue('mock-token');

jest.mock('../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    getAuthToken: mockGetAuthToken,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

jest.mock('../../hooks/useMyTeam', () => ({
  useMyTeam: () => ({ teamId: null }),
}));

jest.mock('../../assets/images/salem_common_sunny.png', () => 'mock-image.png');
jest.mock('../../assets/images/new_logo.png', () => 'mock-logo.png');

const mockUseAuth = useAuth as jest.Mock;
const mockUseUser = useUser as jest.Mock;

const mockLeagueBase = {
  id: 'league-uuid-1',
  name: 'Fall 2026 Flag Football',
  description: 'Competitive 7v7 league',
  start_date: '2026-09-01',
  end_date: '2026-11-01',
  num_weeks: 8,
  format: '7v7',
  tournament_format: 'round_robin',
  game_duration: 60,
  games_per_week: 1,
  max_teams: 4,
  min_teams: 4,
  registration_deadline: '2026-08-25',
  registration_fee: 0,
  is_active: true,
  registered_players_count: 5,
  registered_teams_count: 0,
  is_registration_open: true,
  player_cap: 28,
  spots_remaining: 23,
  is_registered: null,
  created_by: 'admin',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderWithLeagueId(leagueId: string) {
  return render(
    <MemoryRouter initialEntries={[`/leagues/${leagueId}`]}>
      <Routes>
        <Route path="/leagues/:leagueId" element={<LeagueDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    isSignedIn: false,
    userId: null,
    isLoaded: true,
    getToken: jest.fn().mockResolvedValue(null),
  });
  mockUseUser.mockReturnValue({ user: null, isLoaded: true });
});

describe('LeagueDetailPage', () => {
  test('shows loading state initially', () => {
    server.use(
      rest.get('http://localhost:8000/league/:leagueId', async (_req, res, ctx) => {
        await new Promise(r => setTimeout(r, 500));
        return res(ctx.json(mockLeagueBase));
      })
    );
    renderWithLeagueId('league-uuid-1');
    expect(screen.getByText(/loading league/i)).toBeInTheDocument();
  });

  test('shows "League not found" on 404', async () => {
    renderWithLeagueId('nonexistent-id');
    await waitFor(() => {
      expect(screen.getByText(/league not found/i)).toBeInTheDocument();
    });
  });

  test('shows back link when league not found', async () => {
    renderWithLeagueId('nonexistent-id');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to leagues/i })).toBeInTheDocument();
    });
  });

  test('renders league name after loading', async () => {
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText('Fall 2026 Flag Football')).toBeInTheDocument();
    });
  });

  test('renders league description', async () => {
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText('Competitive 7v7 league')).toBeInTheDocument();
    });
  });

  test('renders standings empty state message', async () => {
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText(/standings will appear/i)).toBeInTheDocument();
    });
  });

  test('renders schedule empty state message', async () => {
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText(/schedule will appear/i)).toBeInTheDocument();
    });
  });

  test('does not show YOUR STATUS section when not signed in', async () => {
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText('Fall 2026 Flag Football')).toBeInTheDocument();
    });
    expect(screen.queryByText('YOUR STATUS')).not.toBeInTheDocument();
  });

  test('shows YOUR STATUS section when signed in', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    mockUseUser.mockReturnValue({ user: { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }, isLoaded: true });
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText('YOUR STATUS')).toBeInTheDocument();
    });
  });

  test('shows "Register Now" button when signed in and not registered', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    mockUseUser.mockReturnValue({ user: { id: 'user-1' }, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/league/league-uuid-1', (_req, res, ctx) => {
        return res(ctx.json({ ...mockLeagueBase, is_registered: false }));
      })
    );
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /register now/i }).length).toBeGreaterThan(0);
    });
  });

  test('shows Unregister button when registered without a team', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    mockUseUser.mockReturnValue({ user: { id: 'user-1' }, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/league/league-uuid-1', (_req, res, ctx) => {
        return res(ctx.json({ ...mockLeagueBase, is_registered: true }));
      }),
      rest.get('http://localhost:8000/registration/player/user-1/leagues', (_req, res, ctx) => {
        return res(ctx.json([
          { id: 'reg-1', league_id: 'league-uuid-1', registration_status: 'confirmed', team_id: null, group_id: null, group_name: null },
        ]));
      })
    );
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unregister/i })).toBeInTheDocument();
    });
  });

  test('shows confirm/cancel when Unregister is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    mockUseUser.mockReturnValue({ user: { id: 'user-1' }, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/league/league-uuid-1', (_req, res, ctx) => {
        return res(ctx.json({ ...mockLeagueBase, is_registered: true }));
      }),
      rest.get('http://localhost:8000/registration/player/user-1/leagues', (_req, res, ctx) => {
        return res(ctx.json([
          { id: 'reg-1', league_id: 'league-uuid-1', registration_status: 'confirmed', team_id: null, group_id: null, group_name: null },
        ]));
      })
    );
    renderWithLeagueId('league-uuid-1');
    const unregisterBtn = await screen.findByRole('button', { name: /unregister/i });
    await user.click(unregisterBtn);
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  test('cancels unregister confirm dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    mockUseUser.mockReturnValue({ user: { id: 'user-1' }, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/league/league-uuid-1', (_req, res, ctx) => {
        return res(ctx.json({ ...mockLeagueBase, is_registered: true }));
      }),
      rest.get('http://localhost:8000/registration/player/user-1/leagues', (_req, res, ctx) => {
        return res(ctx.json([
          { id: 'reg-1', league_id: 'league-uuid-1', registration_status: 'confirmed', team_id: null, group_id: null, group_name: null },
        ]));
      })
    );
    renderWithLeagueId('league-uuid-1');
    const unregisterBtn = await screen.findByRole('button', { name: /unregister/i });
    await user.click(unregisterBtn);
    const cancelBtn = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /unregister/i })).toBeInTheDocument();
  });

  test('renders standings table when standings exist', async () => {
    server.use(
      rest.get('http://localhost:8000/league/league-uuid-1/standings', (_req, res, ctx) => {
        return res(ctx.json([
          { rank: 1, team_id: 'team-1', team_name: 'The Eagles', wins: 3, losses: 1, points_for: 42, points_against: 28, win_percentage: 0.75 },
          { rank: 2, team_id: 'team-2', team_name: 'The Hawks', wins: 2, losses: 2, points_for: 35, points_against: 35, win_percentage: 0.5 },
        ]));
      })
    );
    renderWithLeagueId('league-uuid-1');
    await waitFor(() => {
      expect(screen.getByText('The Eagles')).toBeInTheDocument();
      expect(screen.getByText('The Hawks')).toBeInTheDocument();
    });
  });
});
