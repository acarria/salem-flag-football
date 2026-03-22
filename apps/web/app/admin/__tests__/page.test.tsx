import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import AdminPage from '../page';
import { useAuth, useUser } from '@clerk/nextjs';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin',
}));

jest.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: true, isLoading: false }),
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

beforeEach(() => {
  mockReplace.mockClear();
  mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: jest.fn() });
  mockUseUser.mockReturnValue({
    user: {
      firstName: 'Admin',
      lastName: 'User',
      primaryEmailAddress: { emailAddress: 'admin@test.com' },
    },
  });
});

describe('AdminPage', () => {
  test('renders admin dashboard heading', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });

  test('renders all section headings', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('Leagues')).toBeInTheDocument();
    });
    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Admins')).toBeInTheDocument();
  });

  test('redirects non-signed-in user', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: jest.fn() });
    render(<AdminPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
