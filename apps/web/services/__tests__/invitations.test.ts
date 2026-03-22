import { server } from '../../__mocks__/server';
import { rest } from 'msw';
import { invitationService } from '../public/invitations';

describe('InvitationApiService', () => {
  test('getInvitation calls correct endpoint', async () => {
    let capturedUrl = '';
    server.use(
      rest.get('http://localhost:8000/registration/invite/:token', (req, res, ctx) => {
        capturedUrl = req.url.toString();
        return res(ctx.json({ status: 'pending', group_id: 'g1', group_name: 'G', league_id: 'l1', league_name: 'L', inviter_name: 'A', invitee_first_name: 'B', invitee_last_name: 'C', expires_at: new Date().toISOString() }));
      })
    );
    await invitationService.getInvitation('test-token-123');
    expect(capturedUrl).toContain('/registration/invite/test-token-123');
  });

  test('acceptInvitation sends bearer token in Authorization header', async () => {
    let capturedAuthHeader = '';
    server.use(
      rest.post('http://localhost:8000/registration/invite/:token/accept', (req, res, ctx) => {
        capturedAuthHeader = req.headers.get('Authorization') || '';
        return res(ctx.json({ success: true }));
      })
    );
    await invitationService.acceptInvitation('some-token', 'my-jwt-token');
    expect(capturedAuthHeader).toBe('Bearer my-jwt-token');
  });

  test('declineInvitation uses correct URL', async () => {
    let capturedUrl = '';
    server.use(
      rest.post('http://localhost:8000/registration/invite/:token/decline', (req, res, ctx) => {
        capturedUrl = req.url.toString();
        return res(ctx.json({ success: true }));
      })
    );
    await invitationService.declineInvitation('decline-token', 'jwt');
    expect(capturedUrl).toContain('/registration/invite/decline-token/decline');
  });

  test('getMyGroups calls correct endpoint with auth header', async () => {
    let capturedUrl = '';
    let capturedAuthHeader = '';
    server.use(
      rest.get('http://localhost:8000/registration/groups/mine', (req, res, ctx) => {
        capturedUrl = req.url.toString();
        capturedAuthHeader = req.headers.get('Authorization') || '';
        return res(ctx.json([]));
      })
    );
    await invitationService.getMyGroups('auth-token-123');
    expect(capturedUrl).toContain('/registration/groups/mine');
    expect(capturedAuthHeader).toBe('Bearer auth-token-123');
  });

  test('getInvitation throws on 404', async () => {
    server.use(
      rest.get('http://localhost:8000/registration/invite/:token', (_req, res, ctx) => {
        return res(ctx.status(404), ctx.json({ detail: 'Not found' }));
      })
    );
    await expect(invitationService.getInvitation('bad-token')).rejects.toThrow();
  });

  test('acceptInvitation throws on 404', async () => {
    server.use(
      rest.post('http://localhost:8000/registration/invite/:token/accept', (_req, res, ctx) => {
        return res(ctx.status(404), ctx.json({ detail: 'Not found' }));
      })
    );
    await expect(invitationService.acceptInvitation('bad-token', 'jwt')).rejects.toThrow();
  });
});
