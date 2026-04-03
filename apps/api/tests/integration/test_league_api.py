from uuid import uuid4
from tests.conftest import make_league, make_player, make_league_player, make_user_override
from app.utils.clerk_jwt import get_optional_user
from app.main import app


def test_get_public_leagues(client, db):
    make_league(db, name="Active League")
    db.commit()
    resp = client.get("/league/public/leagues")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    names = [l["name"] for l in data]
    assert "Active League" in names


def test_is_registered_null_for_anonymous(client, db):
    make_league(db)
    db.commit()
    resp = client.get("/league/public/leagues")
    assert resp.status_code == 200
    for league in resp.json():
        assert league["is_registered"] is None


def test_is_registered_true_for_authed_user(client, db):
    CLERK_ID = "clerk_league_test"
    league = make_league(db)
    player = make_player(db, clerk_user_id=CLERK_ID, email="leaguer@example.com")
    make_league_player(db, league.id, player.id, status="confirmed")
    db.commit()

    app.dependency_overrides[get_optional_user] = make_user_override({"id": CLERK_ID})
    resp = client.get("/league/public/leagues")
    app.dependency_overrides.pop(get_optional_user, None)

    assert resp.status_code == 200
    leagues_data = resp.json()
    target = next((l for l in leagues_data if l["id"] == str(league.id)), None)
    assert target is not None
    assert target["is_registered"] is True


def test_get_league_by_id(client, db):
    league = make_league(db, name="Single League")
    db.commit()
    resp = client.get(f"/league/{league.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Single League"


def test_get_league_not_found(client, db):
    resp = client.get(f"/league/{uuid4()}")
    assert resp.status_code == 404


def test_uuid_path_param_invalid_returns_422(client, db):
    resp = client.get("/league/not-a-uuid/standings")
    assert resp.status_code == 422


def test_get_standings_empty(client, db):
    league = make_league(db)
    db.commit()
    resp = client.get(f"/league/{league.id}/standings")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_schedule_empty(client, db):
    league = make_league(db)
    db.commit()
    resp = client.get(f"/league/{league.id}/schedule")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_games"] == 0


def test_no_n1_queries(client, db):
    """Verify that listing 10 leagues doesn't cause unbounded DB queries."""
    from sqlalchemy import event as sa_event
    query_count = {"n": 0}
    engine_bind = db.get_bind()

    @sa_event.listens_for(engine_bind, "before_cursor_execute")
    def count_queries(conn, cursor, statement, parameters, context, executemany):
        query_count["n"] += 1

    for i in range(10):
        make_league(db, name=f"League {i}")
    db.commit()

    query_count["n"] = 0
    resp = client.get("/league/public/leagues")
    assert resp.status_code == 200

    sa_event.remove(engine_bind, "before_cursor_execute", count_queries)
    # Should be O(constant) queries, not O(n). Allow up to 10 queries for 10 leagues.
    assert query_count["n"] < 10


# ---------------------------------------------------------------------------
# Additional league coverage tests
# ---------------------------------------------------------------------------

def test_get_league_detail_not_found(client, db):
    resp = client.get(f"/league/{uuid4()}")
    assert resp.status_code == 404


def test_get_league_detail_with_auth(client, db):
    league = make_league(db)
    player = make_player(db, clerk_user_id="auth_user_detail", email="detail@example.com")
    make_league_player(db, league.id, player.id)
    db.commit()
    from app.utils.clerk_jwt import get_optional_user
    app.dependency_overrides[get_optional_user] = make_user_override({"id": "auth_user_detail"})
    resp = client.get(f"/league/{league.id}")
    app.dependency_overrides.pop(get_optional_user, None)
    assert resp.status_code == 200
    assert resp.json()["is_registered"] is True


def test_standings_no_games(client, db):
    league = make_league(db)
    db.commit()
    resp = client.get(f"/league/{league.id}/standings")
    assert resp.status_code == 200
    assert resp.json() == []


def test_standings_league_not_found(client, db):
    resp = client.get(f"/league/{uuid4()}/standings")
    assert resp.status_code == 404


def test_schedule_no_games(client, db):
    league = make_league(db)
    db.commit()
    resp = client.get(f"/league/{league.id}/schedule")
    assert resp.status_code == 200
    assert resp.json()["total_games"] == 0


def test_schedule_league_not_found(client, db):
    resp = client.get(f"/league/{uuid4()}/schedule")
    assert resp.status_code == 404
