# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salem Flag Football League Platform — a **Turborepo monorepo** with a **Next.js (App Router) frontend** (`apps/web/`) and a **FastAPI (Python) backend** (`apps/api/`), using PostgreSQL and Clerk for auth. Frontend deploys to Vercel; backend deploys to AWS Lambda via SAM.

## Development Commands

### Local Dev
```bash
turbo dev                  # Start all apps in parallel (recommended)
docker-compose up          # Start full stack via Docker (DB, backend, frontend)
docker-compose up -d db    # Start only the database
```

### Backend
```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload        # Dev server (port 8000)
alembic upgrade head                 # Run DB migrations
alembic revision --autogenerate -m "description"  # Create new migration
```

### Frontend
```bash
cd apps/web
npm install
npm run dev    # Dev server (port 3000)
npm run build  # Production build
npm test       # Jest tests
```

### Tests (preferred — uses Makefile)
```bash
make test           # Full backend suite (starts/stops ephemeral test DB automatically)
make test-unit      # Backend unit tests only — no DB required, runs instantly
make test-integration  # Backend integration tests only
make test-cov       # Full backend suite + terminal + XML coverage report
make frontend-test  # Frontend Jest tests
make frontend-test-cov  # Frontend tests + coverage
```

### Tests (manual)
```bash
# Backend — requires test DB running (make test-db-up)
cd apps/api
pip install -r requirements.txt -r requirements-test.txt
pytest tests/ -v
pytest tests/unit/ -v               # unit only
pytest tests/ --cov=app             # with coverage

# Frontend
cd apps/web && CI=true npm test

# E2E (requires running frontend + backend)
npx playwright test          # all specs under tests/specs/
npx playwright test --ui     # interactive test runner
```

### Test DB lifecycle
```bash
make test-db-up     # Start ephemeral Postgres on port 5433 (docker-compose.test.yml)
make test-db-down   # Stop and remove it
```

## Architecture

### Structure
```
salem-flag-football/
├── apps/
│   ├── web/                  # Next.js App Router frontend (deploys to Vercel)
│   │   ├── app/              # File-based routes (page.tsx = route, layout.tsx = wrapper)
│   │   │   ├── layout.tsx        # Root layout → Providers → AppShell
│   │   │   ├── page.tsx          # / (HomePage)
│   │   │   ├── leagues/page.tsx  # /leagues
│   │   │   ├── leagues/[leagueId]/page.tsx
│   │   │   ├── admin/layout.tsx  # Admin auth guard
│   │   │   ├── admin/page.tsx
│   │   │   ├── admin/leagues/[leagueId]/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── teams/[teamId]/page.tsx
│   │   │   ├── invite/[token]/page.tsx
│   │   │   ├── rules/page.tsx, info/page.tsx, contact/page.tsx
│   │   ├── components/
│   │   │   ├── Providers.tsx        # ClerkProvider + reCAPTCHA + AppShell wrapper
│   │   │   ├── AppShell.tsx         # Navigation chrome, shared layout
│   │   │   ├── layout/             # BaseLayout
│   │   │   ├── modals/             # Registration, ProfileCompletion, etc.
│   │   │   └── common/             # Button, Input, Select, ConfirmDialog, InlineTable
│   │   ├── hooks/                # useAuthenticatedApi, useAdmin, useMyTeam, useLeagues
│   │   ├── services/
│   │   │   ├── core/base.ts        # Shared fetch wrapper (NEXT_PUBLIC_API_URL)
│   │   │   ├── admin/              # Admin API calls (league.ts)
│   │   │   └── public/             # Public API calls (contact, invitations)
│   │   ├── middleware.ts          # Clerk route protection for /admin(.*)
│   │   └── public/images/        # Static assets
│   └── api/                  # FastAPI backend (deploys to AWS Lambda via SAM)
│       ├── app/
│       │   ├── api/
│       │   │   ├── admin/       # Admin-only endpoints (league, team, schedule, fields)
│       │   │   ├── schemas/     # Pydantic request/response models
│       │   │   ├── registration.py  # Solo + group registration, invite flow, group management
│       │   │   ├── league.py        # Public league endpoints (list, detail, standings, schedule)
│       │   │   ├── user.py, team.py, contact.py
│       │   ├── handlers/        # Lambda entry points (non-API invocations)
│       │   │   └── deadline_handler.py  # Invoked by EventBridge Scheduler at registration deadline
│       │   ├── models/          # SQLAlchemy ORM models (all PKs are UUIDs)
│       │   ├── services/        # Business logic layer
│       │   │   ├── league_service.py          # get_player_cap, get_occupied_spots
│       │   │   ├── team_generation_service.py # _run_team_generation, trigger_team_generation_if_ready
│       │   │   └── scheduler_service.py       # schedule_deadline_job (EventBridge Scheduler)
│       │   ├── utils/clerk_jwt.py  # JWT validation via JWKS; get_current_user, get_optional_user
│       │   ├── core/
│       │   │   ├── config.py    # Settings loaded from env vars (with startup validation)
│       │   │   └── limiter.py   # Shared slowapi Limiter instance — always import from here
│       │   ├── db/              # Database connection/session setup
│       │   └── main.py          # FastAPI app, router registration, CORS; Mangum handler at bottom
├── packages/
│   └── types/src/index.ts    # Shared TypeScript types (@salem/types workspace package)
├── apps/infra/
│   └── sam/template.yaml     # AWS SAM template (Lambda, API Gateway, EventBridge)
├── turbo.json                # Turborepo pipeline (build, dev, test, lint)
├── pnpm-workspace.yaml       # pnpm workspaces: apps/*, packages/*
├── docker-compose.yml
├── docker-compose.test.yml   # Ephemeral test DB (port 5433, tmpfs, auto-created)
├── Makefile                  # Test orchestration entry point
├── playwright.config.ts      # E2E config — baseURL=localhost:3000, testDir=tests/specs/
└── tests/specs/              # Playwright E2E specs
```

### Key Architectural Patterns

**Backend**: FastAPI with modular routers. Admin endpoints live under `apps/api/app/api/admin/` with a shared `dependencies.py` for admin role verification. Business logic is separated into `services/`. All DB models use UUID primary keys.

**Frontend**: Next.js App Router. All pages that use React state, effects, Clerk hooks, or event handlers have `'use client'` at the top. Static pages (rules, info) are Server Components. Navigation uses `next/link` (`<Link href="">`) and `next/navigation` (`useRouter`, `useParams`). Auth is handled by `@clerk/nextjs` — `Providers.tsx` wraps `ClerkProvider` + `GoogleReCaptchaProvider` + `AppShell`, `middleware.ts` protects `/admin(.*)`. `useAuthenticatedApi()` is the standard way to make authenticated API requests.


**Auth Flow**: Clerk issues JWTs → backend validates via JWKS endpoint (`utils/clerk_jwt.py`). The backend handles issuer normalization (trailing slash) and fetches user email from Clerk API since it's not in the JWT by default.

**Deployment Target — AWS SAM (Lambda)**: The backend is designed to run on AWS Lambda via Mangum. `main.py` exports `handler = Mangum(app, lifespan="off")`. Do not introduce long-running background threads or in-process schedulers (e.g. APScheduler) — use EventBridge Scheduler instead.

**Database Connections**: `db/db.py` detects Lambda via `AWS_LAMBDA_FUNCTION_NAME` and uses `NullPool` to prevent connection exhaustion. Locally it uses `QueuePool` (SQLAlchemy default). RDS Proxy is the intended production connection manager.

**Registration Status Convention**: All confirmed players (solo and group members who accepted) use `registration_status="confirmed"`. There is no admin approval flow — solo registrations are confirmed immediately. The value `"registered"` is a legacy bug — do not use it. Valid values: `"confirmed"`, `"pending"` (invitation not yet accepted), `"declined"`, `"expired"`.

**Registration Cap Model**: Effective occupancy = confirmed players + pending group invitations. Pending invitations hold reserved spots so groups can form before all members accept. `league_service.get_occupied_spots()` computes this. The cap itself is `max_teams × players_per_team` (7v7 → 7, 5v5 → 5).

**Game Formats**: Only `'7v7'` and `'5v5'` are valid. `'6v6'` was removed. `max_teams` cannot exceed 10.

**Team Generation Trigger**: `team_generation_service.trigger_team_generation_if_ready()` is called after every solo registration and group invite acceptance. It is a no-op unless `confirmed_count == player_cap AND pending_invites == 0`. At deadline, `handlers/deadline_handler.py` first expires pending invitations, then calls the same function.

**Deadline Scheduling**: `scheduler_service.schedule_deadline_job()` creates an EventBridge Scheduler one-time rule. Requires `SCHEDULER_ROLE_ARN` and `DEADLINE_LAMBDA_ARN` env vars. If absent (local dev), it logs a warning and skips — trigger manually via `POST /admin/leagues/{id}/trigger-team-generation`.

**Optional auth on public endpoints**: Public endpoints that can personalise their response when a user is signed in should use `get_optional_user` from `utils/clerk_jwt.py` as their dependency. It returns `{"id": user_id}` for a valid token or `None` for missing/invalid tokens — never raises. Do not use `get_current_user` on public endpoints; it returns 401 for unauthenticated requests. The `is_registered` field on public league responses is computed this way.

**N+1 query pattern**: Never query inside a loop. List endpoints must bulk-fetch all related records with `.filter(Model.id.in_(ids))` and build lookup dicts before the assembly loop. Use `func.count` with `.group_by` for aggregate counts. This applies to admin endpoints (`get_all_leagues`, `get_league_members`) and public endpoints (`get_my_groups`, `get_my_invitations`) alike.

**Pagination on admin list endpoints**: Admin endpoints that return unbounded lists must accept `skip: int = 0` and `limit: int = Query(default=N, le=MAX)` parameters and apply `.offset(skip).limit(limit)` to the query. Cap `limit` with `min(limit, MAX)` as a server-side guard.

**Async context — event loop**: Inside `async def` route handlers, use `asyncio.get_running_loop()` to get the current event loop. `asyncio.get_event_loop()` is deprecated in Python 3.10+ inside async contexts and will emit `DeprecationWarning`.

**Wrapping sync calls in async handlers**: If a route handler is `async def` but needs to call a synchronous blocking function (e.g. `send_contact_message`), use `await loop.run_in_executor(None, functools.partial(fn, **kwargs))`. Never call blocking I/O directly in an async handler.

**get_player_cap raises on unknown format**: `league_service.get_player_cap()` raises `ValueError` for any format string other than `'7v7'` or `'5v5'`. Do not add new formats without updating `_PLAYERS_PER_TEAM` in `league_service.py`.

**Config startup validation**: `core/config.py` raises `RuntimeError` at import time if critical settings are invalid (empty `TEAM_NAMES`/`TEAM_COLORS`, non-positive `TEAM_GENERATION_DIVISOR` or `INVITATION_EXPIRY_DAYS`). Add similar guards for any new setting where a zero or empty value would cause a silent bug at runtime.

**Health check**: `GET /health` probes the database with `SELECT 1` and returns 503 if the query fails. It uses `db: Session = Depends(get_db)` like any other endpoint — do not bypass the connection pool.

## Testing

### Architecture
Three layers, all run on the host machine (never inside containers):

| Layer | Tool | Location | DB needed |
|-------|------|----------|-----------|
| Backend unit | pytest | `apps/api/tests/unit/` | No |
| Backend integration | pytest + TestClient | `apps/api/tests/integration/` | Yes (port 5433) |
| Frontend unit/component | Jest + RTL + MSW | `apps/web/**/__tests__/` | No |
| E2E | Playwright | `tests/specs/` | Yes (port 5432) |

### Test DB isolation
Integration tests use **SQLAlchemy savepoints** for per-test isolation. Each test wraps in an outer transaction that is never committed; app-level `session.commit()` calls only release a savepoint. The outer transaction rolls back at the end of every test — no truncation scripts, no leakage between tests.

The test DB (`flagfootball_test`) runs in `docker-compose.test.yml` on port **5433**, separate from the dev DB on port 5432. It uses `tmpfs` (in-memory) so no data persists between test runs.

### Test structure
```
apps/api/tests/
├── conftest.py          # Session-scoped engine, savepoint db fixture, factory helpers,
│                        #   auth dependency overrides (make_user_override)
├── unit/
│   ├── test_league_service.py        # get_player_cap, get_occupied_spots
│   ├── test_team_generation_service.py
│   ├── test_admin_service.py
│   └── test_deadline_handler.py
└── integration/
    ├── test_registration_api.py      # Solo + group registration endpoints
    ├── test_invitation_api.py        # Accept, decline, revoke
    ├── test_league_api.py            # Public league list/detail/standings/schedule
    ├── test_unregister_api.py
    └── test_admin_api.py

apps/web/
├── __mocks__/
│   ├── handlers.ts          # MSW v1 handlers for all API endpoints
│   ├── server.ts            # MSW Node server
│   └── @clerk/nextjs.ts     # Jest manual mock for Clerk
├── setupTests.ts            # MSW lifecycle (beforeAll/afterEach/afterAll)
├── test-utils.tsx           # Custom render wrapper
├── hooks/__tests__/         # useMyTeam, useAdmin
├── services/__tests__/      # invitations service
└── app/**/__tests__/        # LeaguesPage, LeagueDetailPage, InvitePage
```

### Auth in tests
- **Backend unit/integration**: `app.dependency_overrides[get_current_user] = make_user_override({"id": ..., "email": ...})` — defined in `conftest.py`
- **Backend E2E**: Set `TESTING=true` and `TEST_BYPASS_TOKEN=<secret>` — the backend bypasses JWKS validation for requests with `Authorization: Bearer <token>`. Never enable in production.
- **Frontend**: `jest.mock('@clerk/nextjs', ...)` via the manual mock at `apps/web/__mocks__/@clerk/nextjs.ts`

### CI
- `.github/workflows/backend-tests.yml` — runs on push/PR to `apps/api/**`
- `.github/workflows/frontend-tests.yml` — runs on push/PR to `apps/web/**`
- `.github/workflows/playwright.yml` — runs on all pushes to `main`
- Both backend and frontend upload coverage to Codecov

### Writing new tests
- **New backend endpoint**: add cases to the relevant `tests/integration/test_*_api.py`. Use `make_league`, `make_player`, etc. from `conftest.py` to seed data. Override auth with `make_user_override`.
- **New service function**: add to `tests/unit/`. Import and call directly — no HTTP overhead.
- **New frontend component/hook**: add a `__tests__/` file next to the source. Add any new API endpoints to `__mocks__/handlers.ts`.
- Do not add `import app.models.*` to conftest — models are already loaded transitively via `from app.main import app` and those imports would overwrite the FastAPI `app` instance with the Python package.

## Database

- **ORM**: SQLAlchemy (async sessions)
- **Migrations**: Alembic (`apps/api/alembic/versions/`)
- **All PKs/FKs are UUIDs** — never use integer IDs

Key tables: `users`, `leagues`, `players`, `teams`, `groups`, `group_invitations`, `league_players`, `games`, `fields`, `field_availability`, `league_fields`, `admin_config`

## Environment Variables

Copy `env.example` to `.env`. Required:
```
DATABASE_URL=postgresql://...
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-instance.clerk.accounts.dev/
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Lambda/production additional vars (omit locally to disable deadline scheduling):
```
SCHEDULER_ROLE_ARN=arn:aws:iam::...  # IAM role EventBridge Scheduler assumes to invoke Lambda
DEADLINE_LAMBDA_ARN=arn:aws:lambda:...  # ARN of deadline_handler Lambda function
```

Set automatically by Lambda runtime (do not set manually):
```
AWS_LAMBDA_FUNCTION_NAME  # presence triggers NullPool in db.py
```

## Auth Notes

- Backend admin protection: `apps/api/app/api/admin/dependencies.py`
- Clerk JWT issuer may include a trailing slash — the JWT util normalizes this
- Email is not in the JWT payload; the backend fetches it from the Clerk API using `CLERK_SECRET_KEY`

## Security Patterns

These conventions are established and must be preserved when modifying or adding code.

**Admin access control**: The only source of truth for admin status is the `admin_config` table, queried via `AdminService`. Never hardcode emails or user IDs as an access gate anywhere in the frontend or backend.

**Fail-closed email ownership**: Invitation accept/decline endpoints must fail closed. The guard is:
```python
jwt_email = user.get("email", "").lower()
if not jwt_email or jwt_email != inv.email.lower():
    raise HTTPException(status_code=403, detail="This invitation was not sent to your email address.")
```
The `not jwt_email` check is intentional — an empty email must never pass.

**Email normalization**: All email values stored in the `players` table must be `.lower().strip()`. Apply this on every create and update path, not just one of them.

**Token invalidation**: After an invitation is accepted **or declined**, set `inv.token = None`. The `group_invitations.token` column is nullable for this reason. Do not re-use or log raw token values. Do not include the token in any response body — the caller already has it from the URL or the pending-invitations list.

**Rate limiting**: Use `@limiter.limit(...)` from `app.core.limiter` (not a locally-constructed `Limiter`). The key function uses the leftmost `X-Forwarded-For` IP. Add rate limits to any public endpoint that accepts a token or user-supplied identifier.

**Error responses**: Return generic messages to clients (`"An internal error occurred. Please try again."`). Log the full exception server-side. Never propagate exception strings or stack traces to API responses.

**PII in logs**: Do not log raw email addresses. Use entity IDs (`player.id`, `group.id`, `inv.id`) in log messages. Email is acceptable in `DEBUG`-level messages only if explicitly needed for local troubleshooting.

**reCAPTCHA pattern**: Wrap `httpx` calls in `verify_recaptcha` with `timeout=5.0` and catch `httpx.TimeoutException` → 503, other exceptions → 400. Always call `resp.raise_for_status()` before parsing.

**HTTP security headers**: `SecurityHeadersMiddleware` in `main.py` sets all required headers including HSTS, CSP, and Permissions-Policy. Do not remove or weaken these. If adding a new middleware, register it after `SecurityHeadersMiddleware` so headers are always present.

**Deadline handler invocation**: `deadline_handler.py` must verify `event.get("source") == "aws.scheduler"` before processing. The `DeadlineFunction` in the SAM template has no API Gateway event source — only `SchedulerExecutionRole` can invoke it.

**Input validation**: Always use Pydantic models (never `data: dict`). All string fields need `max_length`; email fields use `EmailStr`. UUID path params must be typed `UUID` not `str`. Error detail strings must be static — never embed request values (no f-strings with user input).

**Group member email visibility**: `GET /registration/groups/mine` must redact member emails for non-organizers. The rule: include `email` only if `is_organizer` (the viewer is the group creator) or the member is the requesting user (`p.id == player.id`). Pending invitee emails are visible to the organizer only. Non-organizers receive `null` for all other emails. `GroupMemberDetail.email` is `Optional[str]` for this reason.

**Status constants**: All status string values are defined in `app/core/constants.py`. Use these constants instead of bare string literals in Python logic. DB-level CheckConstraints and column defaults still use raw strings.

**`get_optional_user` silent catch**: The bare `except Exception: return None` in `get_optional_user` is intentional per the optional-auth contract. Any token validation failure silently falls through to unauthenticated access. Do not narrow or remove this catch.

**Correlation IDs**: `CorrelationIDMiddleware` in `app/core/middleware.py` generates or propagates `X-Correlation-ID` on every request. The ID is stored in `request.state.correlation_id` and returned in the response header.

**Admin identity resolution**: `get_admin_user` tries `clerk_user_id` first (immutable), then falls back to email. The `admin_configs.clerk_user_id` column is nullable — existing admins without it continue to work via email.

## Known Limitations

**Email delivery**: Email sends (waiver prompts, group invitations, contact form) are fire-and-forget. Failed sends are logged but not retried. If a critical email (e.g., waiver prompt) fails silently, the player may miss their signing deadline. Future improvement: introduce an SQS queue for outbound email with DLQ and retry policy.

**Rate limiting on Lambda**: Rate limiting via slowapi uses in-memory state per Lambda instance. Under high concurrency with many warm instances, the effective rate limit is `configured_limit x instance_count`. For strict enforcement in production, migrate to a Redis-backed or DynamoDB-backed rate limiter.

**Tournament format**: Only `round_robin` is fully implemented. The `swiss` tournament format is accepted by the schema but schedule generation raises 501. When Swiss is implemented, refactor `PLAYERS_PER_TEAM` / `get_player_cap` to use a strategy pattern instead of hardcoded branching.

**Frontend test coverage**: 12 pages and 14+ components have no tests. Priority gaps: admin league detail page, waiver signing flow, registration modal, contact page, and teams page.
