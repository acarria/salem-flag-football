import pytest
from tests.conftest import (
    make_league, make_player, make_league_player, make_user_override
)
from app.utils.clerk_jwt import get_current_user
from app.main import app


USER_ID = "test_clerk_user_1"
USER_EMAIL = "testuser@example.com"
USER_DATA = {"id": USER_ID, "email": USER_EMAIL}

OTHER_USER_ID = "test_clerk_user_other"
OTHER_USER_DATA = {"id": OTHER_USER_ID, "email": "other@example.com"}

VALID_PROFILE = {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "555-0000",
    "date_of_birth": "1990-01-01",
    "gender": "male",
    "communications_accepted": True,
}


@pytest.fixture(autouse=True)
def set_auth(client):
    app.dependency_overrides[get_current_user] = make_user_override(USER_DATA)
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ── GET /user/me ──────────────────────────────────────────────────────


def test_get_my_profile_success(client, db):
    """Existing player with matching clerk_user_id returns profile fields."""
    player = make_player(
        db,
        clerk_user_id=USER_ID,
        email="john@example.com",
        first_name="John",
        last_name="Doe",
    )
    db.commit()

    resp = client.get("/user/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john@example.com"
    assert "payment_status" not in data
    assert "waiver_status" not in data


def test_get_my_profile_not_found(client, db):
    """No player record for the authenticated user returns 404."""
    resp = client.get("/user/me")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Profile not found"


# ── PUT /user/me ──────────────────────────────────────────────────────


def test_update_my_profile_create(client, db):
    """When no player exists, PUT /user/me creates a new player record."""
    resp = client.put("/user/me", json=VALID_PROFILE)
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john@example.com"
    assert data["gender"] == "male"
    assert data["date_of_birth"] == "1990-01-01"


def test_update_my_profile_update(client, db):
    """When a player exists, PUT /user/me updates the existing record."""
    make_player(
        db,
        clerk_user_id=USER_ID,
        email="old@example.com",
        first_name="Old",
        last_name="Name",
    )
    db.commit()

    resp = client.put("/user/me", json=VALID_PROFILE)
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john@example.com"


def test_update_my_profile_invalid_date(client, db):
    """Bad date_of_birth format returns 422 (Pydantic validation)."""
    payload = {**VALID_PROFILE, "date_of_birth": "not-a-date"}
    resp = client.put("/user/me", json=payload)
    assert resp.status_code == 422


def test_update_my_profile_email_normalized(client, db):
    """Email is lowercased and stripped on create via PUT /user/me."""
    from app.models.player import Player

    payload = {**VALID_PROFILE, "email": "  JOHN@EXAMPLE.COM  "}
    resp = client.put("/user/me", json=payload)
    assert resp.status_code == 200

    db.expire_all()
    player = db.query(Player).filter(Player.clerk_user_id == USER_ID).first()
    assert player is not None
    assert player.email == "john@example.com"


# ── GET /user/profile/{user_id} ──────────────────────────────────────


def test_get_profile_by_id_success(client, db):
    """Matching user_id returns the profile."""
    make_player(
        db,
        clerk_user_id=USER_ID,
        email="john@example.com",
        first_name="John",
        last_name="Doe",
    )
    db.commit()

    resp = client.get(f"/user/profile/{USER_ID}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["email"] == "john@example.com"


def test_get_profile_by_id_forbidden(client, db):
    """Requesting a different user_id returns 403."""
    resp = client.get(f"/user/profile/{OTHER_USER_ID}")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Forbidden"


def test_get_profile_by_id_not_found(client, db):
    """Matching user but no player record returns 404."""
    resp = client.get(f"/user/profile/{USER_ID}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Profile not found"


# ── GET /user/profile/{user_id}/registered/{league_id} ───────────────


def test_check_registration_true(client, db):
    """Player registered in the league returns is_registered: true."""
    league = make_league(db)
    player = make_player(db, clerk_user_id=USER_ID, email="john@example.com")
    make_league_player(db, league.id, player.id, status="confirmed")
    db.commit()

    resp = client.get(f"/user/profile/{USER_ID}/registered/{league.id}")
    assert resp.status_code == 200
    assert resp.json()["is_registered"] is True


def test_check_registration_false(client, db):
    """Player exists but is not registered in the league returns is_registered: false."""
    league = make_league(db)
    make_player(db, clerk_user_id=USER_ID, email="john@example.com")
    db.commit()

    resp = client.get(f"/user/profile/{USER_ID}/registered/{league.id}")
    assert resp.status_code == 200
    assert resp.json()["is_registered"] is False


def test_check_registration_no_player(client, db):
    """No player record at all returns is_registered: false."""
    league = make_league(db)
    db.commit()

    resp = client.get(f"/user/profile/{USER_ID}/registered/{league.id}")
    assert resp.status_code == 200
    assert resp.json()["is_registered"] is False


def test_check_registration_forbidden(client, db):
    """Wrong user_id returns 403."""
    league = make_league(db)
    db.commit()

    resp = client.get(f"/user/profile/{OTHER_USER_ID}/registered/{league.id}")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Forbidden"


# ── PUT /user/profile/{user_id} ──────────────────────────────────────


def test_update_profile_by_id_success(client, db):
    """Matching user_id with existing player updates the record."""
    make_player(
        db,
        clerk_user_id=USER_ID,
        email="old@example.com",
        first_name="Old",
        last_name="Name",
    )
    db.commit()

    resp = client.put(f"/user/profile/{USER_ID}", json=VALID_PROFILE)
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john@example.com"


def test_update_profile_by_id_forbidden(client, db):
    """Wrong user_id returns 403."""
    resp = client.put(f"/user/profile/{OTHER_USER_ID}", json=VALID_PROFILE)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Forbidden"


def test_update_profile_by_id_creates(client, db):
    """No existing player for matching user_id creates a new record."""
    resp = client.put(f"/user/profile/{USER_ID}", json=VALID_PROFILE)
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john@example.com"
    assert data["gender"] == "male"
