import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import InvitePage from '../page';
import { useAuth } from '@clerk/nextjs';
import { server } from '../../../../__mocks__/server';
import { rest } from 'msw';

const mockUseAuth = useAuth as jest.Mock;

let mockToken = 'valid-token';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ token: mockToken }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/invite/${mockToken}`,
}));

beforeEach(() => {
  mockToken = 'valid-token';
  mockUseAuth.mockReturnValue({
    isSignedIn: false,
    userId: null,
    isLoaded: true,
    getToken: jest.fn().mockResolvedValue(null),
  });
  mockPush.mockClear();
});

describe('InvitePage', () => {
  test('shows loading state while fetching invitation', () => {
    server.use(
      rest.get('http://localhost:8000/registration/invite/:token', async (_req, res, ctx) => {
        await new Promise(r => setTimeout(r, 500));
        return res(ctx.json({}));
      })
    );
    render(<InvitePage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows error page when invitation is not found', async () => {
    mockToken = 'invalid-token-xyz';
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByText(/invitation not found/i)).toBeInTheDocument();
    });
  });

  test('shows Go Home button on error page', async () => {
    mockToken = 'invalid-token-xyz';
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });
  });

  test('renders invitation details for a valid pending token', async () => {
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByText(/bob smith/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/the sharks/i)).toBeInTheDocument();
    expect(screen.getByText(/fall 2026 flag football/i)).toBeInTheDocument();
  });

  test('shows sign in prompt when unauthenticated and invitation is pending', async () => {
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByText(/sign in to accept/i)).toBeInTheDocument();
    });
  });

  test('shows Clerk SignIn component when unauthenticated', async () => {
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    });
  });

  test('shows Accept and Decline buttons when signed in with pending invitation', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
  });

  test('shows expired message for expired invitation', async () => {
    mockToken = 'expired-token';
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  test('does not show Accept/Decline buttons for expired invitation', async () => {
    mockToken = 'expired-token';
    render(<InvitePage />);
    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^decline$/i })).not.toBeInTheDocument();
  });

  test('shows success message after accepting invitation', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    render(<InvitePage />);
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(screen.getByText(/you're in/i)).toBeInTheDocument();
    });
  });

  test('shows declined message after declining invitation', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    render(<InvitePage />);
    const declineBtn = await screen.findByRole('button', { name: /^decline$/i });
    await userEvent.click(declineBtn);
    await waitFor(() => {
      expect(screen.getByText(/invitation declined/i)).toBeInTheDocument();
    });
  });

  test('navigates home when Go Home is clicked on success screen', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    render(<InvitePage />);
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(screen.getByText(/you're in/i)).toBeInTheDocument();
    });
    const goHomeBtn = screen.getByRole('button', { name: /go home/i });
    await userEvent.click(goHomeBtn);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  test('shows error message when accept fails', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    server.use(
      rest.post('http://localhost:8000/registration/invite/valid-token/accept', (_req, res, ctx) => {
        return res(ctx.status(400), ctx.json({ detail: 'Invitation already used' }));
      })
    );
    render(<InvitePage />);
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(screen.getByText(/invitation already used/i)).toBeInTheDocument();
    });
  });

  test('shows "Processing..." on buttons while action is in flight', async () => {
    let resolveAccept!: () => void;
    const acceptPending = new Promise<void>(res => { resolveAccept = res; });
    server.use(
      rest.post('http://localhost:8000/registration/invite/valid-token/accept', async (_req, res, ctx) => {
        await acceptPending;
        return res(ctx.json({ success: true }));
      })
    );
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      userId: 'user-1',
      isLoaded: true,
      getToken: jest.fn().mockResolvedValue('mock-jwt'),
    });
    render(<InvitePage />);
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    userEvent.click(acceptBtn); // intentionally no await
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
    resolveAccept();
  });
});
