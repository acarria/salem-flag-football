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
│   │   ├── league.py            # Public league endpoints
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
│   ├── utils/clerk_jwt.py       # JWT validation via JWKS
│   ├── core/config.py           # Settings from env vars
│   ├── db/db.py                 # NullPool on Lambda, QueuePool locally
│   └── main.py                  # FastAPI app, middleware, routers, Mangum handler
├── frontend/src/
│   ├── pages/                   # AdminPage, LeagueAdminPage, ProfilePage, LeaguesPage, InvitePage
│   ├── components/modals/       # RegistrationModal, ProfileCompletionModal
│   ├── services/
│   │   ├── core/                # Base API client (Clerk token injection)
│   │   ├── admin/               # Admin API clients
│   │   └── public/              # Public API clients (invitations, leagues)
│   ├── hooks/                   # useAdmin, useAuthenticatedApi
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
- Public league responses include `is_registration_open`, `player_cap`, `spots_remaining`

### Registration Flows

**Solo**: Player registers → `registration_status = "confirmed"` immediately. Cap checked first; 400 if full.

**Group**: Organizer registers (confirmed immediately) + sends invitations to exactly `format_size - 1` players. Invitees get a 7-day expiring token via email. Acceptance requires authentication; JWT email must match the invitation address. Token is nulled after acceptance.

**Status values**: `"confirmed"` | `"pending"` | `"declined"` | `"expired"`

### Team Generation

`trigger_team_generation_if_ready()` is called after every solo registration and every invite acceptance. It is a no-op unless `confirmed_count == player_cap AND pending_invitations == 0`. Teams are generated with group preservation (group members stay together).

Manual trigger: `POST /admin/leagues/{id}/trigger-team-generation`

### Deadline Handler

When a league deadline is set, `scheduler_service.schedule_deadline_job()` creates an EventBridge Scheduler one-time rule. At the deadline, `handlers/deadline_handler.py`:
1. Expires all pending invitations for the league
2. Calls `trigger_team_generation_if_ready`

Requires `SCHEDULER_ROLE_ARN` and `DEADLINE_LAMBDA_ARN` env vars. If absent (local dev), scheduling is skipped with a log warning.

### Admin Access

Admin status is managed via the `admin_config` table and seeded on startup via `ADMIN_EMAIL`. The `dependencies.py` in `api/admin/` enforces this on every admin route.

## API Reference

### Admin (`/admin/...`) — requires admin role

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/me` | Check admin status |
| `GET/POST` | `/admin/leagues` | List / create leagues |
| `PUT/DELETE` | `/admin/leagues/{id}` | Update / delete league |
| `GET` | `/admin/leagues/{id}/members` | League members |
| `POST` | `/admin/leagues/{id}/generate-teams` | Generate teams |
| `POST` | `/admin/leagues/{id}/trigger-team-generation` | Force team gen check |
| `POST` | `/admin/leagues/{id}/generate-schedule` | Generate schedule |
| `GET` | `/admin/leagues/{id}/schedule` | Get schedule |
| `PUT` | `/admin/games/{id}` | Edit game |
| `POST` | `/admin/games/{id}/score` | Record score |
| `POST` | `/admin/leagues/{id}/generate-playoff-bracket` | Generate playoff bracket |
| `GET/POST` | `/admin/fields` | List / create fields |
| `PUT/DELETE` | `/admin/fields/{id}` | Update / delete field |
| `POST/GET` | `/admin/fields/{id}/availability` | Add / list availability slots |
| `PUT/DELETE` | `/admin/fields/{id}/availability/{avail_id}` | Update / delete slot |
| `POST` | `/admin/leagues/{id}/fields/{field_id}` | Associate field with league |
| `GET/POST/DELETE` | `/admin/admins` | List / add / remove admins |

### Public / Player

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/league/public/leagues` | Browse leagues |
| `GET` | `/league/standings` | Live standings |
| `GET` | `/league/schedule` | Schedule |
| `GET/PUT` | `/user/me` | Get / update profile |
| `POST` | `/registration/player` | Solo registration |
| `POST` | `/registration/group` | Group registration + send invitations |
| `GET` | `/registration/invite/{token}` | View invitation (public) |
| `POST` | `/registration/invite/{token}/accept` | Accept invitation (authenticated) |
| `POST` | `/registration/invite/{token}/decline` | Decline invitation (authenticated) |
| `GET` | `/registration/invitations/me` | My pending invitations |
| `GET` | `/registration/groups/mine` | My groups with member status |
| `DELETE` | `/registration/groups/invitations/{id}` | Revoke invitation (organizer only) |
| `POST` | `/contact` | Contact form (reCAPTCHA required) |

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
- **Rate limiting**: `slowapi` on all public endpoints; key uses leftmost `X-Forwarded-For` IP. Contact: `5/hour`. Invite token lookup: `10/minute`.
- **Input validation**: All endpoints use Pydantic models. Player emails normalized to `lowercase + strip`.
- **Invitation ownership**: Accept/decline fail closed — JWT email must be non-empty and match the invitation address, otherwise 403.
- **Token lifecycle**: Invitation tokens are nulled after acceptance and expire after 7 days.
- **HTTP headers**: `SecurityHeadersMiddleware` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'none'`, `Permissions-Policy`.
- **Error responses**: All 500s return generic messages. JWT errors return `"Invalid or expired token"`. Full errors logged server-side only.
- **PII**: Logs use entity IDs, not email addresses.
- **Secrets**: `.env` locally; SSM Parameter Store in production (`{{resolve:ssm:...}}` in SAM template).
- **CORS**: `allow_credentials=True` — set `CORS_ORIGINS` to exact frontend origin in production. SAM `AllowedOrigin` must be overridden at deploy time.
- **Deadline Lambda**: `DeadlineFunction` has no API Gateway source; only `SchedulerExecutionRole` (least-privilege IAM) can invoke it. Handler validates `event["source"] == "aws.scheduler"`.

## Deployment

See `infrastructure/README.md`. The SAM template is in `infrastructure/sam/template.yaml`.

```bash
cd infrastructure/sam
sam build
sam deploy --guided  # first time
sam deploy --parameter-overrides AllowedOrigin=https://your-app.com  # subsequent
```

Secrets must be in SSM Parameter Store at `/flagfootball/*` before deploying (see `template.yaml` for the full list).
