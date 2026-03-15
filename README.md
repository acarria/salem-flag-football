# Salem Flag Football League Platform

A comprehensive flag football league management platform for the Salem Flag Football League in Salem, Massachusetts. This platform handles player registration, league management, team organization, and provides a modern web interface for both players and administrators.

## Architecture

This is a full-stack monorepo with the following structure:

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy + PostgreSQL
- **Authentication**: Clerk (JWT-based)
- **Database**: PostgreSQL with Alembic migrations
- **Deployment (local)**: Docker Compose
- **Deployment (production target)**: AWS SAM — Lambda + API Gateway + EventBridge Scheduler + RDS (via RDS Proxy)

> The backend is Lambda-ready via [Mangum](https://mangum.io/). `main.py` exports `handler = Mangum(app, lifespan="off")`. Do not introduce in-process background schedulers (e.g. APScheduler) — all deferred work uses EventBridge Scheduler or SQS.

## Current Functionality

### Implemented Features

#### **Authentication & User Management**
- JWT-based authentication via Clerk
- User profile creation and management
- Admin role verification and access control
- Profile completion workflow for new users

#### **League Management (Admin)**
- **League Creation**: Full CRUD operations for leagues
  - Support for multiple tournament formats (Round Robin, Swiss, Playoff Bracket, Compass Draw)
  - Game formats: `7v7` and `5v5` (6v6 removed)
  - Configurable season settings (weeks, game duration, max teams ≤ 10)
  - Registration fee and deadline management
- **League Statistics**: Real-time player/team counts, registration status, days until start/deadline
- **League Member Management**: View and manage all registered players in a league
- **Team Generation**:
  - Automated team creation with group preservation
  - Manual trigger: `POST /admin/leagues/{id}/generate-teams`
  - **Event-driven auto-trigger**: fires automatically when all spots are confirmed and no pending invitations remain
- **Schedule Generation**: Automated schedule creation with field availability integration
- **Schedule Editing**: Admins can edit individual games (time, field, teams)
- **Score Recording**: Stores scores; standings calculated live from results
- **Field Availability Admin UI**: Expandable per-field panel in the admin dashboard to create, view, and delete recurring or one-time availability slots
- **Admin Management**: Add/remove admin users with role-based permissions
- **Test Data Generation**: Add fake players and data for testing

#### **Registration System**

**Registration Cap Model:**
- Effective occupancy = `confirmed players + pending group invitations`
- Pending invitations hold reserved spots so a group organizer can guarantee space for their full team before all members respond
- Solo players see the league as full if `occupied >= player_cap` (`max_teams × players_per_team`)
- The public `League` response includes `is_registration_open`, `player_cap`, and `spots_remaining` — computed server-side

**Solo Registration:**
- Player registers directly → status immediately set to `"confirmed"`
- Cap is checked before confirming; returns 400 if full
- Auto-triggers team generation check after every confirmation

**Group Registration (Invitation-based):**
- Organizer registers and is immediately confirmed
- Exactly `format_size - 1` invitees required (7v7 = 6, 5v5 = 4)
- Checks that `format_size` spots are available before creating the group
- Invitees receive email invitations with a 7-day expiring token
- Invitees accept/decline via `/invite/:token` (no login to view, login required to accept)
- On acceptance, auto-triggers team generation check — teams generate automatically when every spot is filled with zero pending invitations remaining

**Registration Status Values:** `"confirmed"` | `"pending"` (invite not yet accepted) | `"declined"` | `"expired"`

#### **Group Viewing (Profile Page)**
- Players can view all groups they belong to from their profile
- Shows each member's name, email, and status badge (confirmed / pending / declined / expired)
- Organizers can revoke pending invitations directly from the profile page

#### **Team Management**
- Team creation and assignment
- Player-to-team relationships with league scoping
- Team color customization

#### **Field Management**
- Full CRUD for fields with address information
- Associate fields with leagues
- **Field Availability**: Recurring (day-of-week + date range) and one-time availability windows
  - Admin UI to manage slots per field inline in the `/admin` dashboard
  - Automatic time slot generation from availability windows for schedule generation

#### **Schedule & Standings**
- Automated schedule generation with field availability integration
- Maximum game duration enforcement (60 minutes)
- Schedule editing for admins
- Scores stored on `Game` model; standings calculated live (W/L/T, points, run differential)
- Playoff bracket generation seeded from regular season standings

#### **Deadline-Triggered Team Generation**
- When a league's `registration_deadline` is set, `scheduler_service.schedule_deadline_job()` registers an AWS EventBridge Scheduler one-time rule
- At 23:59 UTC on the deadline date, `handlers/deadline_handler.py` is invoked:
  1. Expires any still-pending group invitations (freeing reserved spots)
  2. Calls `trigger_team_generation_if_ready` to generate teams from whoever is confirmed
- Requires `SCHEDULER_ROLE_ARN` and `DEADLINE_LAMBDA_ARN` env vars (see below); gracefully skips with a log warning if absent (local dev)

#### **Database Schema**
Key tables: `users`, `leagues`, `players`, `teams`, `groups`, `group_invitations`, `league_players`, `games`, `fields`, `field_availability`, `league_fields`, `admin_config`
- All primary and foreign keys use **UUIDs**

---

## Recent Changes

### **Registration Limits & Cap Enforcement** *(2026-03-14)*
- Server-computed `is_registration_open`, `player_cap`, `spots_remaining` on all public league responses
- Reserved-spot model: pending invitations count toward occupancy
- Solo registration status changed from `"pending"` → `"confirmed"` (no separate approval flow)
- Group registration enforces exact format size (`format_size - 1` invitees) and checks that `format_size` spots are available
- `max_teams` capped at 10 via backend validator; `6v6` format removed (valid: `7v7`, `5v5`)
- Frontend registration modal dynamically adjusts max invitees based on league format; shows "Registration Closed" banner if `is_registration_open` is false

### **Event-Driven Team Generation** *(2026-03-14)*
- `services/team_generation_service.py`: `trigger_team_generation_if_ready` auto-fires when `confirmed_count == player_cap AND pending_invites == 0`
- Fixed legacy bug: team generation query was filtering on `status == "registered"` (now `"confirmed"`)
- Trigger called non-fatally after every solo registration and every invite acceptance
- "Generate Teams" and "Generate Schedule" buttons added to the league admin page

### **Group Viewing on Profile** *(2026-03-14)*
- `GET /registration/groups/mine` — returns all groups the caller belongs to with member details
- `DELETE /registration/groups/invitations/{id}` — organizer revokes a pending invitation
- Profile page "My Groups" section with status badges and revoke capability

### **Field Availability Admin UI** *(2026-03-14)*
- Expandable "Availability ▾" panel per field row in the admin dashboard
- Add recurring slots (day-of-week + date range) or one-time slots; delete slots inline
- 4 CRUD endpoints: `POST/GET/PUT/DELETE /admin/fields/{field_id}/availability`

### **Lambda / AWS SAM Migration** *(2026-03-14)*
- APScheduler removed; deadline scheduling replaced with AWS EventBridge Scheduler (`boto3`)
- `db/db.py`: detects Lambda via `AWS_LAMBDA_FUNCTION_NAME`; uses `NullPool` on Lambda, `QueuePool` locally
- `handlers/deadline_handler.py` created as the EventBridge target Lambda
- `main.py` lifespan cleaned up (scheduler start/stop removed; was dead code under `lifespan="off"`)
- `boto3` added to `requirements.txt`; `APScheduler` removed

### **Authentication Hardening** *(prior)*
- Clerk JWT issuer normalization (trailing slash handling)
- Email resolved via Clerk API when absent from JWT
- Diagnostic startup logging for Clerk config

### **Score Recording & Real Standings** *(prior)*
- Score submission stored on `Game` model; live standings from results
- Playoff bracket generation seeded from regular season standings

### **UUID Migration** *(prior)*
- All PKs/FKs migrated from integer IDs to UUIDs

### **Backend & Frontend Modularization** *(prior)*
- Admin API split into `league_management.py`, `team_management.py`, `schedule_management.py`, `admin_management.py`
- Frontend services split into `core/`, `admin/`, `public/`

---

## Work to be Done

### **High Priority**

#### **1. AWS SAM Deployment**
- [ ] Write `template.yaml` (API function, deadline function, scheduler role, RDS Proxy)
- [ ] `DeadlineFunction` SAM resource pointing at `app.handlers.deadline_handler.handler`
- [ ] `SchedulerRole` IAM role (trust: `scheduler.amazonaws.com`, permission: `lambda:InvokeFunction`)
- [ ] RDS Proxy setup for Lambda → RDS connection management
- [ ] CI/CD pipeline (GitHub Actions → `sam build && sam deploy`)

#### **2. Standings & Results**
- [x] Store scores and outcomes on `Game` model
- [x] Live standings (W/L/T, points, run differential)
- [x] Admin score submission interface
- [ ] Real-time standings updates (WebSocket or polling)
- [ ] Support for different scoring systems

#### **3. Payment Integration**
- [ ] Stripe integration
- [ ] Payment status tracking
- [ ] Receipt generation
- [ ] Payment reminder system

#### **4. Waiver Management**
- [ ] Digital waiver system
- [ ] Waiver status tracking and reminders

### **Medium Priority**

#### **5. Communication System**
- [ ] Registration confirmation emails
- [ ] Schedule update notifications
- [ ] Payment and waiver reminders
- [ ] In-app messaging

#### **6. Advanced Tournament Features**
- [ ] Swiss pairing algorithms
- [x] Playoff bracket generation
- [ ] Compass draw support
- [x] Tournament progression tracking

#### **7. Player Management**
- [x] Team balancing with group preservation
- [ ] Player skill level assessment
- [ ] Player availability tracking
- [ ] Substitute player management

### **Low Priority**

#### **8. Analytics & Reporting**
- [ ] League participation analytics
- [ ] Player performance tracking
- [ ] Financial reporting
- [ ] Data export

#### **9. Mobile App**
- [ ] React Native app
- [ ] Push notifications

#### **10. Advanced Features**
- [ ] Weather integration for cancellations
- [ ] Social features

---

## Getting Started

### **Prerequisites**
- Docker and Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.10+ (for local backend dev)

### **Quick Start with Docker**

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd salem-flag-football
   ```

2. **Set up environment:**
   ```bash
   cp env.example .env
   # Fill in your Clerk keys and other values
   ```

3. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/docs

### **Local Development**

#### Frontend
```bash
cd frontend
npm install
npm start
```

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Database
```bash
cd backend
alembic upgrade head
```

---

## Project Structure

```
salem-flag-football/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/               # Admin-only endpoints
│   │   │   │   ├── league_management.py
│   │   │   │   ├── team_management.py
│   │   │   │   ├── schedule_management.py
│   │   │   │   └── admin_management.py
│   │   │   ├── schemas/             # Pydantic models
│   │   │   ├── registration.py      # Solo + group registration, invite flow, group viewing
│   │   │   ├── league.py            # Public league endpoints
│   │   │   ├── user.py
│   │   │   └── team.py
│   │   ├── handlers/
│   │   │   └── deadline_handler.py  # EventBridge-invoked Lambda for deadline team generation
│   │   ├── models/                  # SQLAlchemy ORM models (UUID PKs)
│   │   ├── services/
│   │   │   ├── league_service.py          # get_player_cap, get_occupied_spots
│   │   │   ├── team_generation_service.py # _run_team_generation, trigger_team_generation_if_ready
│   │   │   ├── scheduler_service.py       # EventBridge Scheduler integration
│   │   │   ├── email_service.py           # Resend-based email delivery
│   │   │   └── admin_service.py
│   │   ├── utils/                   # Clerk JWT validation
│   │   ├── core/config.py           # Settings from env vars
│   │   ├── db/db.py                 # Engine (NullPool on Lambda), SessionLocal
│   │   └── main.py                  # FastAPI app + Mangum Lambda handler
│   ├── alembic/                     # DB migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/                   # Includes ProfilePage (My Groups), AdminPage, LeagueAdminPage
│   │   ├── services/
│   │   │   ├── core/                # Base API client + shared types (incl. FieldAvailability)
│   │   │   ├── admin/               # Admin API services
│   │   │   └── public/              # Public API services (incl. invitations.ts)
│   │   ├── hooks/
│   │   └── types/
│   └── Dockerfile
└── docker-compose.yml
```

---

## API Reference

### Admin Endpoints (`/admin/...`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/leagues` | List all leagues |
| `POST` | `/admin/leagues` | Create league |
| `PUT` | `/admin/leagues/{id}` | Update league |
| `DELETE` | `/admin/leagues/{id}` | Delete league |
| `GET` | `/admin/leagues/{id}/members` | League members |
| `POST` | `/admin/leagues/{id}/generate-teams` | Manually generate teams |
| `POST` | `/admin/leagues/{id}/generate-schedule` | Generate schedule |
| `GET` | `/admin/leagues/{id}/schedule` | Get schedule |
| `PUT` | `/admin/games/{id}` | Edit scheduled game |
| `POST` | `/admin/games/{id}/score` | Record score |
| `POST` | `/admin/leagues/{id}/generate-playoff-bracket` | Generate playoff bracket |
| `POST` | `/admin/fields` | Create field |
| `GET` | `/admin/fields` | List fields |
| `PUT` | `/admin/fields/{id}` | Update field |
| `DELETE` | `/admin/fields/{id}` | Delete field |
| `POST` | `/admin/fields/{field_id}/availability` | Add availability slot |
| `GET` | `/admin/fields/{field_id}/availability` | List availability slots |
| `PUT` | `/admin/fields/{field_id}/availability/{avail_id}` | Update slot |
| `DELETE` | `/admin/fields/{field_id}/availability/{avail_id}` | Delete slot |
| `POST` | `/admin/leagues/{id}/fields/{field_id}` | Associate field with league |

### Public / Player Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/league/public/leagues` | Browse leagues (includes `is_registration_open`, `spots_remaining`) |
| `GET` | `/league/standings` | Live standings |
| `GET` | `/league/schedule` | Schedule |
| `POST` | `/registration/player` | Solo registration (status → confirmed immediately) |
| `POST` | `/registration/group` | Group registration + send invitations |
| `GET` | `/registration/invite/{token}` | View invitation (public) |
| `POST` | `/registration/invite/{token}/accept` | Accept invitation (authenticated) |
| `POST` | `/registration/invite/{token}/decline` | Decline invitation |
| `GET` | `/registration/invitations/me` | My pending invitations |
| `GET` | `/registration/groups/mine` | My groups with member status |
| `DELETE` | `/registration/groups/invitations/{id}` | Revoke pending invitation (organizer only) |

---

## Environment Variables

Copy `env.example` to `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/flagfootball

# Clerk Authentication
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-instance.clerk.accounts.dev/
CLERK_SECRET_KEY=sk_test_...

# Email (Resend) — group invitation emails
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
APP_URL=http://localhost:3000

# Admin bootstrap — gets super_admin role on first startup
ADMIN_EMAIL=your-admin@example.com

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_...

# AWS (production / Lambda only — omit locally)
SCHEDULER_ROLE_ARN=arn:aws:iam::...  # IAM role EventBridge Scheduler assumes
DEADLINE_LAMBDA_ARN=arn:aws:lambda:...  # deadline_handler Lambda ARN
```

> `AWS_LAMBDA_FUNCTION_NAME` is set automatically by the Lambda runtime and is used by `db/db.py` to switch to `NullPool`. Do not set it manually.

---

## Security

- All secrets in `.env` (excluded from version control)
- For production: AWS Secrets Manager or Parameter Store
- Clerk JWT validation via JWKS endpoint
- Admin access controlled via database configuration
- Rate limiting via `slowapi`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

## License

MIT License — see the LICENSE file for details.
