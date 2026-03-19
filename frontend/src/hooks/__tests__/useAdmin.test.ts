import { renderHook, waitFor } from '@testing-library/react';
import { useAdmin } from '../useAdmin';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../../__mocks__/server';
import { rest } from 'msw';

jest.mock('../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    getAuthToken: jest.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('useAdmin', () => {
  test('returns isAdmin=false and isLoading=false when not signed in', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });
    const { result } = renderHook(() => useAdmin());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  test('returns isAdmin=true when API responds with is_admin: true', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/admin/me', (_req, res, ctx) => {
        return res(ctx.json({ is_admin: true }));
      })
    );
    const { result } = renderHook(() => useAdmin());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  test('returns isAdmin=false when API responds with is_admin: false', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    const { result } = renderHook(() => useAdmin());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  test('returns isAdmin=false on 403 response', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/admin/me', (_req, res, ctx) => {
        return res(ctx.status(403), ctx.json({ detail: 'Forbidden' }));
      })
    );
    const { result } = renderHook(() => useAdmin());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  test('returns isAdmin=false on 500 error', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    server.use(
      rest.get('http://localhost:8000/admin/me', (_req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ detail: 'Internal Server Error' }));
      })
    );
    const { result } = renderHook(() => useAdmin());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  test('starts with isLoading=true', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    const { result } = renderHook(() => useAdmin());
    expect(result.current.isLoading).toBe(true);
  });
});
