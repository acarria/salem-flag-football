import os
import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

# Set env vars BEFORE importing anything from the app.
# CI overrides TEST_DATABASE_URL; locally it defaults to the docker-compose.test.yml DB (port 5433).
_DEFAULT_TEST_DB = "postgresql://postgres:postgres@localhost:5433/flagfootball_test"
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", _DEFAULT_TEST_DB)
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("CLERK_JWKS_URL", "https://test.clerk.dev/.well-known/jwks.json")
os.environ.setdefault("CLERK_ISSUER", "https://test.clerk.dev/")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("TEST_BYPASS_TOKEN", "test-secret-token-12345")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient

from app.db.db import Base, get_db
from app.main import app
from app.utils.clerk_jwt import get_current_user, get_optional_user
from app.api.admin.dependencies import get_admin_user
from app.models.league import League
from app.models.player import Player
from app.models.league_player import LeaguePlayer
from app.models.group import Group
from app.models.group_invitation import GroupInvitation
from app.models.team import Team
from app.models.admin_config import AdminConfig


@pytest.fixture(scope="session")
def engine():
    try:
        eng = create_engine(TEST_DATABASE_URL, echo=False)
        Base.metadata.create_all(bind=eng)
    except Exception as exc:
        pytest.exit(
            f"Could not connect to test database ({TEST_DATABASE_URL}).\n"
            f"Run 'make test-db-up' to start the test database, then retry.\n"
            f"Error: {exc}"
        )
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture(scope="function")
def db(engine):
    # Wrap each test in an outer transaction that is never committed.
    # The session joins via a SAVEPOINT so that any session.commit() inside
    # the app only releases the savepoint — the outer transaction rolls back
    # everything at the end of the test, giving true per-test isolation.
    connection = engine.connect()
    outer_tx = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        outer_tx.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_optional_user, None)
    app.dependency_overrides.pop(get_admin_user, None)


def make_user_override(data: dict):
    async def _override():
        return data

    return _override


@pytest.fixture(scope="function")
def auth_user_data():
    return {"id": "test_clerk_user_1", "email": "testuser@example.com"}


@pytest.fixture(scope="function")
def admin_user_data():
    return {"id": "admin_clerk_user", "email": "admin@example.com"}


@pytest.fixture(scope="function")
def override_auth(client, auth_user_data):
    """Override get_current_user with a standard test user."""
    app.dependency_overrides[get_current_user] = make_user_override(auth_user_data)
    yield auth_user_data
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(scope="function")
def override_admin(client, db, admin_user_data):
    """Override get_admin_user with an admin user (also seeds admin_config)."""
    admin = AdminConfig(
        email=admin_user_data["email"],
        is_active=True,
        role="admin",
    )
    db.add(admin)
    db.flush()
    app.dependency_overrides[get_current_user] = make_user_override(admin_user_data)
    app.dependency_overrides[get_admin_user] = make_user_override(admin_user_data)
    yield admin_user_data
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)


# --- Factory helpers ---

def make_league(db, **kwargs) -> League:
    """Create and flush a League with sensible defaults."""
    from datetime import date
    defaults = dict(
        name="Test League",
        start_date=date(2026, 6, 1),
        num_weeks=8,
        format="7v7",
        tournament_format="round_robin",
        max_teams=4,
        game_duration=60,
        games_per_week=1,
        min_teams=4,
        registration_fee=0,
        is_active=True,
        created_by="system",
    )
    defaults.update(kwargs)
    league = League(**defaults)
    db.add(league)
    db.flush()
    return league


def make_player(db, clerk_user_id=None, email=None, **kwargs) -> Player:
    """Create and flush a Player."""
    from datetime import date
    cuid = clerk_user_id or f"clerk_{uuid4().hex[:8]}"
    em = email or f"{uuid4().hex[:8]}@example.com"
    defaults = dict(
        clerk_user_id=cuid,
        first_name="Test",
        last_name="Player",
        email=em.lower().strip(),
        phone="555-0000",
        date_of_birth=date(1990, 1, 1),
        communications_accepted=False,
        payment_status="pending",
        waiver_status="pending",
        created_by=cuid,
        is_active=True,
    )
    defaults.update(kwargs)
    player = Player(**defaults)
    db.add(player)
    db.flush()
    return player


def make_league_player(db, league_id, player_id, status="confirmed", **kwargs) -> LeaguePlayer:
    """Create and flush a LeaguePlayer."""
    defaults = dict(
        league_id=league_id,
        player_id=player_id,
        registration_status=status,
        payment_status="pending",
        waiver_status="pending",
        created_by="system",
        is_active=True,
    )
    defaults.update(kwargs)
    lp = LeaguePlayer(**defaults)
    db.add(lp)
    db.flush()
    return lp


def make_group_invitation(db, group_id, league_id, invited_by_id, email=None, status="pending", expires_future=True, **kwargs) -> GroupInvitation:
    """Create and flush a GroupInvitation."""
    import secrets
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7) if expires_future else now - timedelta(days=1)
    inv = GroupInvitation(
        group_id=group_id,
        league_id=league_id,
        email=(email or f"{uuid4().hex[:8]}@example.com").lower(),
        first_name="Inv",
        last_name="Itee",
        token=secrets.token_urlsafe(16),
        status=status,
        invited_by=invited_by_id,
        expires_at=expires_at,
        **kwargs,
    )
    db.add(inv)
    db.flush()
    return inv


def make_group(db, league_id, created_by_player_id, name="Test Group", **kwargs) -> Group:
    """Create and flush a Group."""
    group = Group(
        league_id=league_id,
        name=name,
        created_by=created_by_player_id,
        created_by_clerk="system",
        is_active=True,
        **kwargs,
    )
    db.add(group)
    db.flush()
    return group
