import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InvitePage from '../InvitePage';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../../__mocks__/server';
import { rest } from 'msw';

const mockUseAuth = useAuth as jest.Mock;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderInvitePage(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InvitePage />} />
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
  mockNavigate.mockClear();
});

describe('InvitePage', () => {
  test('shows loading state while fetching invitation', () => {
    server.use(
      rest.get('http://localhost:8000/registration/invite/:token', async (_req, res, ctx) => {
        await new Promise(r => setTimeout(r, 500));
        return res(ctx.json({}));
      })
    );
    renderInvitePage('valid-token');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows error page when invitation is not found', async () => {
    renderInvitePage('invalid-token-xyz');
    await waitFor(() => {
      expect(screen.getByText(/invitation not found/i)).toBeInTheDocument();
    });
  });

  test('shows Go Home button on error page', async () => {
    renderInvitePage('invalid-token-xyz');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });
  });

  test('renders invitation details for a valid pending token', async () => {
    renderInvitePage('valid-token');
    await waitFor(() => {
      expect(screen.getByText(/bob smith/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/the sharks/i)).toBeInTheDocument();
    expect(screen.getByText(/fall 2026 flag football/i)).toBeInTheDocument();
  });

  test('shows sign in prompt when unauthenticated and invitation is pending', async () => {
    renderInvitePage('valid-token');
    await waitFor(() => {
      expect(screen.getByText(/sign in to accept/i)).toBeInTheDocument();
    });
  });

  test('shows Clerk SignIn component when unauthenticated', async () => {
    renderInvitePage('valid-token');
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
    renderInvitePage('valid-token');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
  });

  test('shows expired message for expired invitation', async () => {
    renderInvitePage('expired-token');
    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  test('does not show Accept/Decline buttons for expired invitation', async () => {
    renderInvitePage('expired-token');
    await waitFor(() => {
      // Wait for the expired status to be visible
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
    renderInvitePage('valid-token');
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
    renderInvitePage('valid-token');
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
    renderInvitePage('valid-token');
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(screen.getByText(/you're in/i)).toBeInTheDocument();
    });
    const goHomeBtn = screen.getByRole('button', { name: /go home/i });
    await userEvent.click(goHomeBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
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
    renderInvitePage('valid-token');
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
    renderInvitePage('valid-token');
    const acceptBtn = await screen.findByRole('button', { name: /^accept$/i });
    userEvent.click(acceptBtn); // intentionally no await
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
    resolveAccept();
  });
});
