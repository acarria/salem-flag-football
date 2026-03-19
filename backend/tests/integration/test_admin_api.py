import pytest
from datetime import date
from uuid import uuid4
from tests.conftest import make_league, make_user_override
from app.utils.clerk_jwt import get_current_user
from app.api.admin.dependencies import get_admin_user
from app.main import app
from app.models.admin_config import AdminConfig

ADMIN_DATA = {"id": "admin_clerk", "email": "admin@example.com"}
NON_ADMIN_DATA = {"id": "regular_clerk", "email": "regular@example.com"}

LEAGUE_PAYLOAD = {
    "name": "Admin Test League",
    "start_date": "2026-09-01",
    "num_weeks": 8,
    "format": "7v7",
    "tournament_format": "round_robin",
    "game_duration": 60,
    "games_per_week": 1,
    "min_teams": 4,
}


def _seed_admin(db, email):
    ac = AdminConfig(email=email.lower(), is_active=True, role="admin")
    db.add(ac)
    db.flush()
    return ac


def test_create_league_success(client, db):
    _seed_admin(db, ADMIN_DATA["email"])
    db.commit()
    app.dependency_overrides[get_current_user] = make_user_override(ADMIN_DATA)
    app.dependency_overrides[get_admin_user] = make_user_override(ADMIN_DATA)
    resp = client.post("/admin/leagues", json=LEAGUE_PAYLOAD)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Admin Test League"


def test_create_league_non_admin_403(client, db):
    app.dependency_overrides[get_current_user] = make_user_override(NON_ADMIN_DATA)
    # Do NOT override get_admin_user -- let it fail naturally
    resp = client.post("/admin/leagues", json=LEAGUE_PAYLOAD)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


def test_unauthenticated_registration_401(client, db):
    # Remove all auth overrides
    app.dependency_overrides.pop(get_current_user, None)
    league = make_league(db)
    db.commit()
    payload = {
        "firstName": "X", "lastName": "Y", "email": "x@example.com",
        "phone": "555", "dateOfBirth": "1990-01-01", "gender": "other",
        "termsAccepted": True, "communicationsAccepted": False,
        "league_id": str(league.id),
    }
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 401


def test_uuid_path_param_invalid_returns_422(client, db):
    resp = client.get("/league/not-a-uuid/standings")
    assert resp.status_code == 422


def test_admin_league_list_requires_admin(client, db):
    app.dependency_overrides[get_current_user] = make_user_override(NON_ADMIN_DATA)
    resp = client.get("/admin/leagues")
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403
