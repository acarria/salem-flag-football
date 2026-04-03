import pytest
from tests.conftest import make_league, make_player, make_league_player, make_user_override
from app.utils.clerk_jwt import get_current_user
from app.main import app
from app.models.league_player import LeaguePlayer

CLERK_ID = "clerk_unreg_test"
USER_DATA = {"id": CLERK_ID, "email": "unreg@example.com"}


@pytest.fixture(autouse=True)
def set_auth(client):
    app.dependency_overrides[get_current_user] = make_user_override(USER_DATA)
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_unregister_success(client, db):
    league = make_league(db)
    player = make_player(db, clerk_user_id=CLERK_ID, email="unreg@example.com")
    make_league_player(db, league.id, player.id, status="confirmed")
    db.commit()

    resp = client.delete(f"/registration/leagues/{league.id}")
    assert resp.status_code == 200

    db.expire_all()
    lp = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.player_id == player.id,
    ).first()
    assert lp.is_active is False


def test_unregister_fails_when_team_assigned(client, db):
    from app.models.team import Team
    league = make_league(db)
    player = make_player(db, clerk_user_id=CLERK_ID, email="unreg@example.com")
    team = Team(league_id=league.id, name="T1", color="#f00", created_by="system")
    db.add(team)
    db.flush()
    lp = make_league_player(db, league.id, player.id, status="confirmed")
    lp.team_id = team.id
    db.commit()

    resp = client.delete(f"/registration/leagues/{league.id}")
    assert resp.status_code == 409


def test_unregister_not_registered(client, db):
    league = make_league(db)
    make_player(db, clerk_user_id=CLERK_ID, email="unreg@example.com")
    db.commit()
    resp = client.delete(f"/registration/leagues/{league.id}")
    assert resp.status_code == 404
