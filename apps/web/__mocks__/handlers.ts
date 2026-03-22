import { rest } from 'msw';

const API_BASE = 'http://localhost:8000';

const mockLeague = {
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

const mockPastLeague = {
  ...mockLeague,
  id: 'league-uuid-2',
  name: 'Spring 2026 Flag Football',
  is_active: false,
  is_registration_open: false,
  start_date: '2026-03-01',
  end_date: '2026-05-01',
};

const mockInvitation = {
  group_id: 'group-uuid-1',
  group_name: 'The Sharks',
  league_id: 'league-uuid-1',
  league_name: 'Fall 2026 Flag Football',
  inviter_name: 'Bob Smith',
  invitee_first_name: 'Alice',
  invitee_last_name: 'Jones',
  status: 'pending',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export const handlers = [
  // Public leagues list
  rest.get(`${API_BASE}/league/public/leagues`, (_req, res, ctx) => {
    return res(ctx.json([mockLeague, mockPastLeague]));
  }),

  // Single league
  rest.get(`${API_BASE}/league/:leagueId`, (req, res, ctx) => {
    const { leagueId } = req.params;
    if (leagueId === mockLeague.id) {
      return res(ctx.json(mockLeague));
    }
    return res(ctx.status(404), ctx.json({ detail: 'League not found' }));
  }),

  // Standings
  rest.get(`${API_BASE}/league/:leagueId/standings`, (_req, res, ctx) => {
    return res(ctx.json([]));
  }),

  // Schedule
  rest.get(`${API_BASE}/league/:leagueId/schedule`, (req, res, ctx) => {
    const { leagueId } = req.params;
    return res(ctx.json({
      league_id: leagueId,
      league_name: 'Test League',
      total_games: 0,
      schedule_by_week: {},
    }));
  }),

  // Get invitation
  rest.get(`${API_BASE}/registration/invite/:token`, (req, res, ctx) => {
    const { token } = req.params;
    if (token === 'valid-token') {
      return res(ctx.json(mockInvitation));
    }
    if (token === 'expired-token') {
      return res(ctx.json({ ...mockInvitation, status: 'expired' }));
    }
    return res(ctx.status(404), ctx.json({ detail: 'Invitation not found' }));
  }),

  // Accept invitation
  rest.post(`${API_BASE}/registration/invite/:token/accept`, (req, res, ctx) => {
    const { token } = req.params;
    if (token === 'valid-token') {
      return res(ctx.json({ success: true, message: 'Invitation accepted.' }));
    }
    return res(ctx.status(404), ctx.json({ detail: 'Invitation not found' }));
  }),

  // Decline invitation
  rest.post(`${API_BASE}/registration/invite/:token/decline`, (req, res, ctx) => {
    const { token } = req.params;
    if (token === 'valid-token') {
      return res(ctx.json({ success: true, message: 'Invitation declined.' }));
    }
    return res(ctx.status(404), ctx.json({ detail: 'Invitation not found' }));
  }),

  // Solo registration
  rest.post(`${API_BASE}/registration/player`, (_req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'Successfully registered',
      registration: {
        id: 'reg-uuid-1',
        league_id: 'league-uuid-1',
        league_name: 'Fall 2026 Flag Football',
        player_id: 'player-uuid-1',
        registration_status: 'confirmed',
        payment_status: 'pending',
        waiver_status: 'pending',
        team_id: null,
        group_id: null,
        group_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      player_id: 'player-uuid-1',
    }));
  }),

  // Unregister
  rest.delete(`${API_BASE}/registration/leagues/:leagueId`, (_req, res, ctx) => {
    return res(ctx.json({ success: true, message: 'Unregistered' }));
  }),

  // Player registrations (for useMyTeam and LeagueDetailPage)
  rest.get(`${API_BASE}/registration/player/:userId/leagues`, (_req, res, ctx) => {
    return res(ctx.json([]));
  }),

  // Admin check (default: admin for admin page tests; override per-test with server.use())
  rest.get(`${API_BASE}/admin/me`, (_req, res, ctx) => {
    return res(ctx.json({ is_admin: true }));
  }),

  // Admin leagues
  rest.get(`${API_BASE}/admin/leagues`, (_req, res, ctx) => {
    return res(ctx.json([mockLeague]));
  }),

  rest.post(`${API_BASE}/admin/leagues`, (_req, res, ctx) => {
    return res(ctx.json(mockLeague));
  }),

  // Admin admins
  rest.get(`${API_BASE}/admin/admins`, (_req, res, ctx) => {
    return res(ctx.json([{ id: 'admin-uuid-1', email: 'admin@test.com', role: 'admin', is_active: true, created_at: '2026-01-01T00:00:00Z' }]));
  }),

  rest.post(`${API_BASE}/admin/admins`, (_req, res, ctx) => {
    return res(ctx.json({ id: 'admin-uuid-2', email: 'new@test.com', role: 'admin', is_active: true, created_at: '2026-01-01T00:00:00Z' }));
  }),

  // Admin users
  rest.get(`${API_BASE}/admin/users`, (_req, res, ctx) => {
    return res(ctx.json({ users: [], total: 0, page: 1, page_size: 25, total_pages: 0 }));
  }),

  // Admin fields
  rest.get(`${API_BASE}/admin/fields`, (_req, res, ctx) => {
    return res(ctx.json([]));
  }),

  rest.post(`${API_BASE}/admin/fields`, (_req, res, ctx) => {
    return res(ctx.json({ id: 'field-uuid-1', name: 'Main Field', street_address: '1 Main St', city: 'Salem', state: 'MA', zip_code: '01970', country: 'USA', is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }));
  }),

  // My team
  rest.get(`${API_BASE}/registration/leagues/:leagueId/my-team`, (_req, res, ctx) => {
    return res(ctx.status(404), ctx.json({ detail: 'Not found' }));
  }),

  // User profile
  rest.get(`${API_BASE}/user/me`, (_req, res, ctx) => {
    return res(ctx.status(404), ctx.json(null));
  }),

  // My groups
  rest.get(`${API_BASE}/registration/groups/mine`, (_req, res, ctx) => {
    return res(ctx.json([]));
  }),
];
