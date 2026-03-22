import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import LeaguesPage from '../page';
import { useAuth, useClerk } from '@clerk/nextjs';
import { server } from '../../../__mocks__/server';
import { rest } from 'msw';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/leagues',
}));

jest.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

jest.mock('@/hooks/useMyTeam', () => ({
  useMyTeam: () => ({ teamId: null }),
}));

jest.mock('@/components/layout/BaseLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/modals/RegistrationModal', () => ({
  __esModule: true,
  default: () => null,
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseClerk = useClerk as jest.Mock;

const openSignInMock = jest.fn();

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    isSignedIn: false,
    userId: null,
    isLoaded: true,
    getToken: jest.fn().mockResolvedValue(null),
  });
  mockUseClerk.mockReturnValue({ openSignIn: openSignInMock, signOut: jest.fn() });
});

describe('LeaguesPage', () => {
  test('shows loading state initially', () => {
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', async (_req, res, ctx) => {
        await new Promise(r => setTimeout(r, 500));
        return res(ctx.json([]));
      })
    );
    render(<LeaguesPage />);
    expect(screen.getByText(/loading leagues/i)).toBeInTheDocument();
  });

  test('renders active and past leagues after loading', async () => {
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText('Fall 2026 Flag Football')).toBeInTheDocument();
    });
    expect(screen.getByText('Spring 2026 Flag Football')).toBeInTheDocument();
  });

  test('shows empty state when no leagues are returned', async () => {
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', (_req, res, ctx) => {
        return res(ctx.json([]));
      })
    );
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText(/no leagues available/i)).toBeInTheDocument();
    });
  });

  test('shows error message on API failure', async () => {
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', (_req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ detail: 'Server error' }));
      })
    );
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load leagues/i)).toBeInTheDocument();
    });
  });

  test('shows section labels for active and past leagues', async () => {
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText('ACTIVE LEAGUES')).toBeInTheDocument();
    });
    expect(screen.getByText('PAST LEAGUES')).toBeInTheDocument();
  });

  test('shows "Open" status for active league with open registration', async () => {
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    });
  });

  test('shows "Completed" status for past league', async () => {
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    });
  });

  test('shows Register button when is_registered is null', async () => {
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText('Fall 2026 Flag Football')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument();
  });

  test('shows Register button when signed in and not registered', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('tok'),
    });
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', (_req, res, ctx) => {
        return res(ctx.json([{
          id: 'league-uuid-1',
          name: 'Fall 2026 Flag Football',
          description: 'desc',
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
          is_registered: false,
          created_by: 'admin',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }]));
      })
    );
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument();
    });
  });

  test('shows "Registered" badge when is_registered is true', async () => {
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', (_req, res, ctx) => {
        return res(ctx.json([{
          id: 'league-uuid-1',
          name: 'Fall 2026 Flag Football',
          description: 'desc',
          start_date: '2026-09-01',
          num_weeks: 8,
          format: '7v7',
          tournament_format: 'round_robin',
          game_duration: 60,
          games_per_week: 1,
          min_teams: 4,
          is_active: true,
          registered_players_count: 5,
          registered_teams_count: 0,
          is_registration_open: true,
          player_cap: 28,
          spots_remaining: 23,
          is_registered: true,
          created_by: 'admin',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }]));
      })
    );
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText('Registered')).toBeInTheDocument();
    });
  });

  test('closes error banner when × is clicked', async () => {
    server.use(
      rest.get('http://localhost:8000/league/public/leagues', (_req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ detail: 'Server error' }));
      })
    );
    render(<LeaguesPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load leagues/i)).toBeInTheDocument();
    });
    const closeBtn = screen.getByRole('button', { name: '×' });
    await userEvent.click(closeBtn);
    expect(screen.queryByText(/failed to load leagues/i)).not.toBeInTheDocument();
  });
});
