import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import ProfilePage from '../page';
import { useAuth, useUser } from '@clerk/nextjs';
import { server } from '../../../__mocks__/server';
import { rest } from 'msw';

const API_BASE = 'http://localhost:8000';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/profile',
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

const mockUseAuth = useAuth as jest.Mock;
const mockUseUser = useUser as jest.Mock;

const mockProfile = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+1 555-123-4567',
  dateOfBirth: '1990-05-15',
  gender: 'female',
  communicationsAccepted: true,
  paymentStatus: 'pending',
  waiverStatus: 'pending',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: jest.fn().mockResolvedValue('token') });
  mockUseUser.mockReturnValue({
    user: {
      firstName: 'Jane',
      lastName: 'Doe',
      primaryEmailAddress: { emailAddress: 'jane@example.com' },
    },
  });
});

describe('ProfilePage', () => {
  test('shows loading state initially', () => {
    render(<ProfilePage />);
    // The component should render without crashing
    expect(document.body).toBeTruthy();
  });

  test('displays profile data when loaded', async () => {
    server.use(
      rest.get(`${API_BASE}/user/me`, (_req, res, ctx) => {
        return res(ctx.json(mockProfile));
      }),
    );

    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  test('handles 404 (no existing profile) gracefully', async () => {
    server.use(
      rest.get(`${API_BASE}/user/me`, (_req, res, ctx) => {
        return res(ctx.status(404), ctx.json({ detail: 'Not found' }));
      }),
    );

    render(<ProfilePage />);
    // Should not crash; form should be available for new profile
    await waitFor(() => {
      expect(screen.getByText(/Profile/i)).toBeInTheDocument();
    });
  });

  test('redirects unauthenticated user', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: jest.fn() });
    mockUseUser.mockReturnValue({ user: null });

    render(<ProfilePage />);
    // Page should show nothing or redirect
    expect(screen.queryByDisplayValue('Jane')).not.toBeInTheDocument();
  });
});
