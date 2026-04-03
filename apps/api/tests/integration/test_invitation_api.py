import pytest
from tests.conftest import (
    make_league, make_player, make_group, make_group_invitation,
    make_user_override
)
from app.utils.clerk_jwt import get_current_user
from app.main import app


CLERK_USER_ID = "clerk_invite_test_user"
INVITEE_EMAIL = "invitee@example.com"
USER_DATA = {"id": CLERK_USER_ID, "email": INVITEE_EMAIL}


@pytest.fixture(autouse=True)
def set_auth(client):
    app.dependency_overrides[get_current_user] = make_user_override(USER_DATA)
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _setup_invitation(db, email=INVITEE_EMAIL, expires_future=True, status="pending"):
    league = make_league(db)
    organizer = make_player(db, email="organizer@example.com")
    group = make_group(db, league.id, organizer.id)
    inv = make_group_invitation(
        db, group.id, league.id, organizer.id,
        email=email, expires_future=expires_future, status=status
    )
    db.commit()
    return league, group, organizer, inv


def test_get_invitation_success(client, db):
    _, _, _, inv = _setup_invitation(db)
    resp = client.get(f"/registration/invite/{inv.token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert "invitee_email" not in data  # PII removed from public endpoint


def test_get_invitation_not_found(client, db):
    resp = client.get("/registration/invite/nonexistent-token-xyz")
    assert resp.status_code == 404


def test_get_invitation_expired_returns_expired_status(client, db):
    _, _, _, inv = _setup_invitation(db, expires_future=False)
    resp = client.get(f"/registration/invite/{inv.token}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "expired"


def test_accept_success(client, db):
    league, group, organizer, inv = _setup_invitation(db, email=INVITEE_EMAIL)
    # Create the accepting player
    player = make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()

    token = inv.token
    resp = client.post(f"/registration/invite/{token}/accept")
    assert resp.status_code == 200

    db.expire_all()
    from app.models.group_invitation import GroupInvitation
    from app.models.league_player import LeaguePlayer
    inv_fresh = db.query(GroupInvitation).get(inv.id)
    assert inv_fresh.status == "accepted"
    assert inv_fresh.token is None  # token invalidated

    lp = db.query(LeaguePlayer).filter(
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.league_id == league.id,
    ).first()
    assert lp is not None
    assert lp.registration_status == "confirmed"


def test_accept_wrong_email_fails(client, db):
    league, group, organizer, inv = _setup_invitation(db, email="other@example.com")
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()
    # Our auth user has INVITEE_EMAIL but invite was sent to other@example.com
    resp = client.post(f"/registration/invite/{inv.token}/accept")
    assert resp.status_code == 403


def test_accept_empty_email_fails(client, db):
    _, _, _, inv = _setup_invitation(db, email=INVITEE_EMAIL)
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()
    # Override with empty email
    app.dependency_overrides[get_current_user] = make_user_override({"id": CLERK_USER_ID, "email": ""})
    resp = client.post(f"/registration/invite/{inv.token}/accept")
    assert resp.status_code == 403


def test_accept_already_accepted(client, db):
    _, _, _, inv = _setup_invitation(db, email=INVITEE_EMAIL, status="accepted")
    # Token is None for accepted invitations in real data, but we kept it for the query
    if inv.token is None:
        pytest.skip("token already nulled")
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()
    resp = client.post(f"/registration/invite/{inv.token}/accept")
    assert resp.status_code in (400, 404)


def test_accept_token_nulled_after_accept(client, db):
    _, _, _, inv = _setup_invitation(db, email=INVITEE_EMAIL)
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()
    token = inv.token
    client.post(f"/registration/invite/{token}/accept")
    db.expire_all()
    from app.models.group_invitation import GroupInvitation
    inv_fresh = db.query(GroupInvitation).get(inv.id)
    assert inv_fresh.token is None


def test_decline_success(client, db):
    _, _, _, inv = _setup_invitation(db, email=INVITEE_EMAIL)
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()
    token = inv.token
    resp = client.post(f"/registration/invite/{token}/decline")
    assert resp.status_code == 200
    db.expire_all()
    from app.models.group_invitation import GroupInvitation
    inv_fresh = db.query(GroupInvitation).get(inv.id)
    assert inv_fresh.status == "declined"
    assert inv_fresh.token is None


def test_decline_wrong_email_fails(client, db):
    _, _, _, inv = _setup_invitation(db, email="other@example.com")
    resp = client.post(f"/registration/invite/{inv.token}/decline")
    assert resp.status_code == 403


def test_decline_empty_email_fails(client, db):
    _, _, _, inv = _setup_invitation(db, email=INVITEE_EMAIL)
    app.dependency_overrides[get_current_user] = make_user_override({"id": CLERK_USER_ID, "email": ""})
    resp = client.post(f"/registration/invite/{inv.token}/decline")
    assert resp.status_code == 403


def test_revoke_success(client, db):
    league = make_league(db)
    organizer = make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    group = make_group(db, league.id, organizer.id)
    inv = make_group_invitation(db, group.id, league.id, organizer.id, email="target@example.com")
    db.commit()

    resp = client.delete(f"/registration/groups/invitations/{inv.id}")
    assert resp.status_code == 200
    db.expire_all()
    from app.models.group_invitation import GroupInvitation
    inv_fresh = db.query(GroupInvitation).get(inv.id)
    assert inv_fresh.status == "revoked"


def test_revoke_non_organizer_fails(client, db):
    league = make_league(db)
    organizer = make_player(db, email="real_org@example.com")
    group = make_group(db, league.id, organizer.id)
    inv = make_group_invitation(db, group.id, league.id, organizer.id, email="target@example.com")
    # Current user is NOT the organizer
    make_player(db, clerk_user_id=CLERK_USER_ID, email=INVITEE_EMAIL)
    db.commit()

    resp = client.delete(f"/registration/groups/invitations/{inv.id}")
    assert resp.status_code == 403
