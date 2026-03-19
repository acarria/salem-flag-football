import pytest
from datetime import date, timedelta
from uuid import uuid4
from tests.conftest import (
    make_league, make_player, make_league_player, make_group,
    make_group_invitation, make_user_override
)
from app.utils.clerk_jwt import get_current_user
from app.main import app


CLERK_USER_ID = "clerk_integration_test_user"
USER_DATA = {"id": CLERK_USER_ID, "email": "alice@example.com"}

VALID_PAYLOAD = {
    "firstName": "Alice",
    "lastName": "Smith",
    "email": "alice@example.com",
    "phone": "555-1234",
    "dateOfBirth": "1990-05-15",
    "gender": "female",
    "termsAccepted": True,
    "communicationsAccepted": False,
}


@pytest.fixture(autouse=True)
def set_auth(client):
    app.dependency_overrides[get_current_user] = make_user_override(USER_DATA)
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_solo_register_success(client, db):
    league = make_league(db, format="7v7", max_teams=4)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["registration"]["registration_status"] == "confirmed"


def test_solo_register_email_stored_lowercase(client, db):
    from app.models.player import Player
    league = make_league(db, format="7v7", max_teams=4)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id), "email": "ALICE@EXAMPLE.COM"}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 200
    db.expire_all()
    player = db.query(Player).filter(Player.clerk_user_id == CLERK_USER_ID).first()
    assert player.email == "alice@example.com"


def test_solo_register_email_stored_stripped(client, db):
    from app.models.player import Player
    league = make_league(db, format="7v7", max_teams=4)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id), "email": "  alice@example.com  "}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 200
    db.expire_all()
    player = db.query(Player).filter(Player.clerk_user_id == CLERK_USER_ID).first()
    assert player.email == "alice@example.com"


def test_solo_register_league_not_found(client, db):
    payload = {**VALID_PAYLOAD, "league_id": str(uuid4())}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 404


def test_solo_register_inactive_league(client, db):
    league = make_league(db, is_active=False)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 400


def test_solo_register_deadline_passed(client, db):
    past = date.today() - timedelta(days=1)
    league = make_league(db, registration_deadline=past)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 400


def test_solo_register_league_full(client, db):
    # 5v5 with max_teams=2 -> cap = 10
    league = make_league(db, format="5v5", max_teams=2)
    for _ in range(10):
        p = make_player(db)
        make_league_player(db, league.id, p.id, status="confirmed")
    db.commit()

    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 400
    assert "full" in resp.json()["detail"].lower()


def test_solo_register_already_registered(client, db):
    league = make_league(db, format="7v7", max_teams=4)
    # First registration
    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp1 = client.post("/registration/player", json=payload)
    assert resp1.status_code == 200
    # Second registration same league
    resp2 = client.post("/registration/player", json=payload)
    assert resp2.status_code == 400
    assert "already registered" in resp2.json()["detail"].lower()


def test_solo_register_invalid_dob_format(client, db):
    league = make_league(db)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id), "dateOfBirth": "not-a-date"}
    resp = client.post("/registration/player", json=payload)
    # Pydantic v2 fires a 422 before the handler runs.
    # Pydantic v2 includes the input value in its built-in validation response,
    # so we only assert the status code here. The CLAUDE.md "no echo" rule applies
    # to custom handler code (f-strings), not Pydantic's built-in validation output.
    assert resp.status_code in (400, 422)


def test_solo_register_unauthenticated(client, db):
    # Remove auth override
    app.dependency_overrides.pop(get_current_user, None)
    league = make_league(db)
    payload = {**VALID_PAYLOAD, "league_id": str(league.id)}
    resp = client.post("/registration/player", json=payload)
    assert resp.status_code == 401


def test_group_register_success(client, db):
    league = make_league(db, format="7v7", max_teams=2)
    # Organizer needs an existing player record
    player = make_player(db, clerk_user_id=CLERK_USER_ID, email="alice@example.com")
    db.commit()

    payload = {
        "league_id": str(league.id),
        "groupName": "Cool Group",
        "termsAccepted": True,
        "communicationsAccepted": False,
        "players": [
            {"firstName": "Bob", "lastName": "Jones", "email": "bob@example.com"},
            {"firstName": "Carol", "lastName": "King", "email": "carol@example.com"},
        ],
    }
    resp = client.post("/registration/group", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    # Organizer confirmed
    from app.models.league_player import LeaguePlayer
    lps = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.player_id == player.id,
    ).all()
    assert len(lps) == 1
    assert lps[0].registration_status == "confirmed"
    # 2 invitations created
    from app.models.group_invitation import GroupInvitation
    invites = db.query(GroupInvitation).filter(
        GroupInvitation.league_id == league.id,
        GroupInvitation.status == "pending",
    ).count()
    assert invites == 2


def test_group_register_too_many_invitees(client, db):
    """7v7 -> max 6 invitees (organizer takes 1 slot)"""
    league = make_league(db, format="7v7", max_teams=2)
    make_player(db, clerk_user_id=CLERK_USER_ID, email="alice@example.com")
    db.commit()

    invitees = [
        {"firstName": f"P{i}", "lastName": "L", "email": f"p{i}@example.com"}
        for i in range(7)  # 7 invitees + organizer = 8, exceeds 7
    ]
    payload = {
        "league_id": str(league.id),
        "groupName": "Big Group",
        "termsAccepted": True,
        "communicationsAccepted": False,
        "players": invitees,
    }
    resp = client.post("/registration/group", json=payload)
    assert resp.status_code == 400
