# Salem Flag Football League Platform

Flag football league management platform — player registration, team generation, scheduling, and standings for the Salem Flag Football League.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) + SQLAlchemy |
| Database | PostgreSQL + Alembic migrations |
| Auth | Clerk (JWT) |
| Email | Resend |
| Local dev | Docker Compose |
| Production | AWS SAM — Lambda (Mangum) + API Gateway HTTP API + EventBridge Scheduler + RDS via RDS Proxy |

## Local Development

```bash
cp env.example .env          # fill in Clerk keys and other values
docker-compose up --build    # starts db, backend (8000), frontend (3000)
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs

To run without Docker:

```bash
# Backend
cd backend && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm start
```

## Project Structure

```
salem-flag-football/
├── backend/app/
│   ├── api/
│   │   ├── admin/               # Admin-only endpoints (league, team, schedule, fields)
│   │   │   └── dependencies.py  # Admin role verification
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── registration.py      # Solo + group registration, invite flow, group management
│   │   ├── league.py            # Public league endpoints (list, detail, standings, schedule)
│   │   ├── user.py
│   │   └── contact.py
│   ├── handlers/
│   │   └── deadline_handler.py  # EventBridge Scheduler target — expires invites, triggers team gen
│   ├── models/                  # SQLAlchemy ORM models (all PKs are UUIDs)
│   ├── services/
│   │   ├── league_service.py          # get_player_cap, get_occupied_spots
│   │   ├── team_generation_service.py # trigger_team_generation_if_ready
│   │   ├── scheduler_service.py       # EventBridge Scheduler integration
│   │   └── email_service.py           # Resend email delivery
│   ├── utils/clerk_jwt.py       # JWT validation via JWKS; get_optional_user for public endpoints
│   ├── core/config.py           # Settings from env vars (startup validation included)
│   ├── db/db.py                 # NullPool on Lambda, QueuePool locally
│   └── main.py                  # FastAPI app, middleware, routers, Mangum handler; /health probes DB
├── frontend/src/
│   ├── pages/
│   │   ├── LeaguesPage.tsx      # League list — cards link to LeagueDetailPage
│   │   ├── LeagueDetailPage.tsx # Per-league page: info, standings, schedule, register/unregister
│   │   ├── TeamPage.tsx         # Stub team page (placeholder)
│   │   ├── AdminPage.tsx
│   │   ├── admin/LeagueAdminPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── InvitePage.tsx
│   ├── components/modals/       # RegistrationModal, ProfileCompletionModal
│   ├── services/
│   │   ├── core/                # Base API client (Clerk token injection), shared types
│   │   ├── admin/league.ts      # Admin + public league API calls
│   │   └── public/invitations.ts # Invitation + group API calls
│   ├── hooks/
│   │   ├── useAdmin.ts
│   │   ├── useAuthenticatedApi.ts
│   │   └── useMyTeam.ts         # Returns teamId if user has a team assigned
│   └── contexts/AuthContext.tsx
├── infrastructure/sam/
│   └── template.yaml            # SAM template: API Gateway, FlagFootballFunction, DeadlineFunction
├── backend/alembic/             # DB migrations
└── docker-compose.yml
```

## Key Concepts

### Registration Cap Model

Effective occupancy = `confirmed players + pending group invitations`. Pending invitations hold reserved spots so a group can form before all members respond.

- `player_cap` = `max_teams × players_per_team` (7v7 → 7 per team, 5v5 → 5 per team)
- `league_service.get_occupied_spots()` computes current occupancy
- `league_service.get_player_cap()` raises `ValueError` for unknown formats (only `'7v7'` and `'5v5'` are valid)
- Public league responses include `is_registration_open`, `player_cap`, `spots_remaining`, `is_registered`

### Registration Flows

**Solo**: Player registers → `registration_status = "confirmed"` immediately. Cap checked first; 400 if full.

**Group**: Organizer registers (confirmed immediately) + sends invitations to exactly `format_size - 1` players. Invitees get a 7-day expiring token via email. Acceptance requires authentication; JWT email must match the invitation address. Token is nulled after acceptance or decline.

**Status values**: `"confirmed"` | `"pending"` | `"declined"` | `"expired"`

### Public League Endpoints with Optional Auth

`GET /league/public/leagues` and `GET /league/{id}` accept an optional Bearer token. When a valid token is provided, the response includes `is_registered: true/false` for that user. Unauthenticated requests return `is_registered: null`. This is handled by `get_optional_user()` in `utils/clerk_jwt.py`, which returns `None` instead of raising for missing/invalid tokens.

### Team Generation

`trigger_team_generation_if_ready()` is called after every solo registration and every invite acceptance. It is a no-op unless `confirmed_count == player_cap AND pending_invitations == 0`. Teams are generated with group preservation (group members stay together). If `teams_count` exceeds the `TEAM_NAMES` list, names are automatically suffixed (e.g., "Team Red 2").

Manual trigger: `POST /admin/leagues/{id}/trigger-team-generation`

### Deadline Handler

When a league deadline is set, `scheduler_service.schedule_deadline_job()` creates an EventBridge Scheduler one-time rule. At the deadline, `handlers/deadline_handler.py`:
1. Expires all pending invitations for the league
2. Calls `trigger_team_generation_if_ready`

Requires `SCHEDULER_ROLE_ARN` and `DEADLINE_LAMBDA_ARN` env vars. If absent (local dev), scheduling is skipped with a log warning.

### Admin Access

Admin status is managed via the `admin_config` table and seeded on startup via `ADMIN_EMAIL`. The `dependencies.py` in `api/admin/` enforces this on every admin route.

### My Team Nav Link

`useMyTeam()` fetches the user's registrations on mount and returns the first `team_id` that is non-null. `BaseLayout` uses this to conditionally show a "My Team" link in the nav bar.

## API Reference

### Admin (`/admin/...`) — requires admin role

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/me` | Check admin status |
| `GET/POST` | `/admin/leagues` | List (paginated, confirmed-only counts) / create leagues |
| `GET/PUT/DELETE` | `/admin/leagues/{id}` | Detail / update / delete league |
| `GET` | `/admin/leagues/{id}/stats` | League statistics |
| `GET` | `/admin/leagues/{id}/members` | League members (paginated) |
| `GET` | `/admin/leagues/{id}/teams` | Teams for a league |
| `POST` | `/admin/leagues/{id}/generate-teams` | Generate teams |
| `POST` | `/admin/leagues/{id}/trigger-team-generation` | Force team gen check |
| `POST` | `/admin/leagues/{id}/generate-schedule` | Generate schedule |
| `GET` | `/admin/leagues/{id}/schedule` | Get schedule |
| `PUT` | `/admin/games/{id}` | Edit game |
| `POST` | `/admin/games/{id}/score` | Record score |
| `POST` | `/admin/leagues/{id}/generate-playoff-bracket` | Generate playoff bracket |
| `GET/POST` | `/admin/fields` | List / create fields |
| `PUT/DELETE` | `/admin/fields/{id}` | Update / delete field |
| `POST/GET` | `/admin/fields/{id}/availability` | Add / list availability slots (paginated) |
| `PUT/DELETE` | `/admin/fields/{id}/availability/{avail_id}` | Update / delete slot |
| `POST` | `/admin/leagues/{id}/fields/{field_id}` | Associate field with league |
| `GET/POST/DELETE` | `/admin/admins` | List / add / remove admins |

### Public / Player

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/league/public/leagues` | Optional | Browse leagues; includes `is_registered` when authenticated |
| `GET` | `/league/{id}` | Optional | Single league detail; includes `is_registered` when authenticated |
| `GET` | `/league/{id}/standings` | None | Live standings |
| `GET` | `/league/{id}/schedule` | None | Public schedule |
| `GET/PUT` | `/user/me` | Required | Get / update profile |
| `POST` | `/registration/player` | Required | Solo registration |
| `POST` | `/registration/group` | Required | Group registration + send invitations |
| `GET` | `/registration/invite/{token}` | None | View invitation details (no token in response) |
| `POST` | `/registration/invite/{token}/accept` | Required | Accept invitation |
| `POST` | `/registration/invite/{token}/decline` | Required | Decline invitation |
| `GET` | `/registration/invitations/me` | Required | My pending invitations |
| `GET` | `/registration/groups/mine` | Required | My groups; non-organizers see only their own email |
| `DELETE` | `/registration/groups/invitations/{id}` | Required | Revoke invitation (organizer only) |
| `DELETE` | `/registration/leagues/{id}` | Required | Unregister from a league |
| `GET` | `/registration/leagues/{id}/my-team` | Required | Caller's team roster (names only, no PII) |
| `GET` | `/registration/player/{userId}/leagues` | Required | Player's registration history |
| `POST` | `/contact` | None | Contact form (reCAPTCHA required) |
| `GET` | `/health` | None | Health check; probes DB with `SELECT 1` |

## Environment Variables

Copy `env.example` to `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/flagfootball

# Clerk
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-instance.clerk.accounts.dev/
CLERK_SECRET_KEY=sk_test_...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
APP_URL=http://localhost:3000

# Admin bootstrap — seeded as super_admin on first startup
ADMIN_EMAIL=your-admin@example.com

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_...

# reCAPTCHA (contact form — omit locally to disable)
RECAPTCHA_SECRET_KEY=...
REACT_APP_RECAPTCHA_SITE_KEY=...

# AWS (production / Lambda only — omit locally to skip deadline scheduling)
SCHEDULER_ROLE_ARN=arn:aws:iam::...
DEADLINE_LAMBDA_ARN=arn:aws:lambda:...
```

`AWS_LAMBDA_FUNCTION_NAME` is set automatically by the Lambda runtime — do not set it manually. Its presence switches `db.py` to `NullPool`.

## Security

- **Auth**: Clerk JWT validated via JWKS (`utils/clerk_jwt.py`). Admin access gated by `admin_config` table.
- **Rate limiting**: All public endpoints use the shared `limiter` from `app.core.limiter` (key = leftmost `X-Forwarded-For` IP). Contact: `5/hour`. Invite token lookup: `10/minute`.
- **Input validation**: All endpoints use Pydantic models with `max_length` on string fields and `EmailStr` on email fields. Player emails normalized to `lowercase + strip`.
- **Invitation ownership**: Accept/decline fail closed — JWT email must be non-empty and match the invitation address, otherwise 403.
- **Token lifecycle**: Invitation tokens are nulled after acceptance or decline, and expire after 7 days.
- **Group member email visibility**: `GET /registration/groups/mine` only returns member emails to the group organizer or the member themselves — other confirmed members and non-organizers see `null`.
- **Token not echoed**: `GET /registration/invite/{token}` response does not include the token field — the caller already has it from the URL.
- **UUID path params**: `revoke_invitation` and `unregister_from_league` use `UUID` typed path params — malformed values return 422 before reaching the ORM.
- **HTTP headers**: `SecurityHeadersMiddleware` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'none'`, `Permissions-Policy`.
- **Error responses**: All 500s return generic messages. JWT errors return `"Invalid or expired token"`. Full errors logged server-side only.
- **PII**: Logs use entity IDs, not email addresses.
- **Secrets**: `.env` locally; SSM Parameter Store in production (`{{resolve:ssm:...}}` in SAM template).
- **CORS**: `allow_credentials=True` — set `CORS_ORIGINS` to exact frontend origin in production. SAM `AllowedOrigin` must be overridden at deploy time.
- **Deadline Lambda**: `DeadlineFunction` has no API Gateway source; only `SchedulerExecutionRole` (least-privilege IAM) can invoke it. Handler validates `event["source"] == "aws.scheduler"`.
- **Frontend base client**: Non-HTTPS `REACT_APP_API_URL` in production now throws at startup rather than logging a warning.

## Deployment

See `infrastructure/README.md`. The SAM template is in `infrastructure/sam/template.yaml`.

```bash
cd infrastructure/sam
sam build
sam deploy --guided  # first time
sam deploy --parameter-overrides AllowedOrigin=https://your-app.com  # subsequent
```

Secrets must be in SSM Parameter Store at `/flagfootball/*` before deploying (see `template.yaml` for the full list).
