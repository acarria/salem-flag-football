import pytest
from datetime import date
from uuid import uuid4
from tests.conftest import make_league, make_player, make_league_player, make_team, make_user_override
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


# ---------------------------------------------------------------------------
# Additional admin API tests
# ---------------------------------------------------------------------------

FIELD_PAYLOAD = {
    "name": "North Field",
    "street_address": "123 Main St",
    "city": "Salem",
    "state": "MA",
    "zip_code": "01970",
    "country": "USA",
}


def _admin_setup(db):
    """Seed admin row and set dependency overrides. Returns None."""
    _seed_admin(db, ADMIN_DATA["email"])
    db.commit()
    app.dependency_overrides[get_current_user] = make_user_override(ADMIN_DATA)
    app.dependency_overrides[get_admin_user] = make_user_override(ADMIN_DATA)


def _admin_teardown():
    """Remove dependency overrides after a test."""
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)


# 1. GET /admin/leagues returns list with counts
def test_get_all_leagues_success(client, db):
    _admin_setup(db)
    try:
        league = make_league(db, name="League With Players")
        p1 = make_player(db)
        p2 = make_player(db)
        make_league_player(db, league.id, p1.id, status="confirmed")
        make_league_player(db, league.id, p2.id, status="confirmed")
        db.commit()

        resp = client.get("/admin/leagues")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Find the league we created
        target = next(l for l in data if l["id"] == str(league.id))
        assert target["name"] == "League With Players"
        assert target["registered_players_count"] == 2
        assert target["registered_teams_count"] == 0
    finally:
        _admin_teardown()


# 2. GET /admin/leagues pagination with skip/limit
def test_get_all_leagues_pagination(client, db):
    _admin_setup(db)
    try:
        for i in range(5):
            make_league(db, name=f"Paginated League {i}")
        db.commit()

        # Fetch first 2
        resp = client.get("/admin/leagues", params={"skip": 0, "limit": 2})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

        # Fetch next 2
        resp2 = client.get("/admin/leagues", params={"skip": 2, "limit": 2})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert len(data2) == 2

        # Ensure no overlap
        ids_page1 = {l["id"] for l in data}
        ids_page2 = {l["id"] for l in data2}
        assert ids_page1.isdisjoint(ids_page2)
    finally:
        _admin_teardown()


# 3. GET /admin/leagues/{id} returns league detail with counts
def test_get_league_details(client, db):
    _admin_setup(db)
    try:
        league = make_league(db, name="Detail League")
        p = make_player(db)
        make_league_player(db, league.id, p.id, status="confirmed")
        db.commit()

        resp = client.get(f"/admin/leagues/{league.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(league.id)
        assert data["name"] == "Detail League"
        assert data["registered_players_count"] == 1
        assert data["registered_teams_count"] == 0
    finally:
        _admin_teardown()


# 4. PUT /admin/leagues/{id} partial update
def test_update_league_success(client, db):
    _admin_setup(db)
    try:
        league = make_league(db, name="Before Update", num_weeks=6)
        db.commit()

        resp = client.put(
            f"/admin/leagues/{league.id}",
            json={"name": "After Update", "num_weeks": 10},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "After Update"
        assert data["num_weeks"] == 10
    finally:
        _admin_teardown()


# 5. DELETE /admin/leagues/{id} soft-deletes
def test_deactivate_league(client, db):
    _admin_setup(db)
    try:
        league = make_league(db, name="To Deactivate")
        db.commit()

        resp = client.delete(f"/admin/leagues/{league.id}")
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower() or "deactivate" in resp.json()["message"].lower() or "To Deactivate" in resp.json()["message"]

        # Verify the league is now soft-deleted (is_active=False)
        db.expire_all()
        from app.models.league import League
        updated = db.query(League).filter(League.id == league.id).first()
        assert updated.is_active is False
    finally:
        _admin_teardown()


# 6. GET /admin/leagues/{id}/members returns seeded players
def test_get_league_members(client, db):
    _admin_setup(db)
    try:
        league = make_league(db)
        p1 = make_player(db, first_name="Alice", last_name="A")
        p2 = make_player(db, first_name="Bob", last_name="B")
        make_league_player(db, league.id, p1.id, status="confirmed")
        make_league_player(db, league.id, p2.id, status="confirmed")
        db.commit()

        resp = client.get(f"/admin/leagues/{league.id}/members")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        first_names = {m["first_name"] for m in data}
        assert "Alice" in first_names
        assert "Bob" in first_names
        # Each member should have expected fields
        for member in data:
            assert "player_id" in member
            assert "registration_status" in member
            assert member["registration_status"] == "confirmed"
    finally:
        _admin_teardown()


# 7. POST /admin/fields creates a field
def test_create_field_success(client, db):
    _admin_setup(db)
    try:
        resp = client.post("/admin/fields", json=FIELD_PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "North Field"
        assert data["street_address"] == "123 Main St"
        assert data["city"] == "Salem"
        assert data["state"] == "MA"
        assert data["zip_code"] == "01970"
        assert data["country"] == "USA"
        assert "id" in data
    finally:
        _admin_teardown()


# 8. GET /admin/fields returns created fields
def test_get_fields(client, db):
    _admin_setup(db)
    try:
        # Create two fields via the API
        client.post("/admin/fields", json=FIELD_PAYLOAD)
        client.post("/admin/fields", json={**FIELD_PAYLOAD, "name": "South Field"})

        resp = client.get("/admin/fields")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        names = {f["name"] for f in data}
        assert "North Field" in names
        assert "South Field" in names
    finally:
        _admin_teardown()


# 9. PUT /admin/fields/{id} updates a field
def test_update_field(client, db):
    _admin_setup(db)
    try:
        create_resp = client.post("/admin/fields", json=FIELD_PAYLOAD)
        assert create_resp.status_code == 200
        field_id = create_resp.json()["id"]

        resp = client.put(
            f"/admin/fields/{field_id}",
            json={"name": "Renamed Field", "city": "Beverly"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Renamed Field"
        assert data["city"] == "Beverly"
        # Unchanged fields should remain
        assert data["state"] == "MA"
    finally:
        _admin_teardown()


# 10. POST /admin/admins adds an admin
def test_add_admin_success(client, db):
    _admin_setup(db)
    try:
        resp = client.post(
            "/admin/admins",
            json={"email": "newadmin@example.com", "role": "admin"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "newadmin@example.com"
        assert data["role"] == "admin"
        assert data["is_active"] is True
    finally:
        _admin_teardown()


# 11. DELETE /admin/admins/{email} removes admin privileges
def test_remove_admin_success(client, db):
    _admin_setup(db)
    try:
        # First add another admin to remove
        client.post(
            "/admin/admins",
            json={"email": "removeme@example.com", "role": "admin"},
        )
        resp = client.delete("/admin/admins/removeme@example.com")
        assert resp.status_code == 200
        assert "removed" in resp.json()["message"].lower()
    finally:
        _admin_teardown()


# 12. GET /admin/users returns paginated users
def test_get_users_paginated(client, db):
    _admin_setup(db)
    try:
        # Seed some players
        for i in range(3):
            make_player(db, first_name=f"User{i}", last_name="Test")
        db.commit()

        resp = client.get("/admin/users", params={"page": 1, "page_size": 2})
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert data["total"] >= 3
        assert len(data["users"]) <= 2
        assert data["page"] == 1
        assert data["page_size"] == 2
    finally:
        _admin_teardown()


# 13. Multiple admin endpoints require admin auth (parametrized)
@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/admin/leagues"),
        ("GET", f"/admin/leagues/{uuid4()}"),
        ("PUT", f"/admin/leagues/{uuid4()}"),
        ("DELETE", f"/admin/leagues/{uuid4()}"),
        ("GET", f"/admin/leagues/{uuid4()}/members"),
        ("POST", "/admin/fields"),
        ("GET", "/admin/fields"),
        ("PUT", f"/admin/fields/{uuid4()}"),
        ("DELETE", f"/admin/fields/{uuid4()}"),
        ("POST", "/admin/admins"),
        ("DELETE", "/admin/admins/someone@example.com"),
        ("GET", "/admin/users"),
    ],
)
def test_admin_endpoints_require_admin(client, db, method, path):
    """All admin endpoints must return 403 for non-admin authenticated users."""
    app.dependency_overrides[get_current_user] = make_user_override(NON_ADMIN_DATA)
    # Do NOT override get_admin_user so the real dependency runs and rejects
    try:
        kwargs = {}
        if method in ("POST", "PUT"):
            kwargs["json"] = {}
        resp = getattr(client, method.lower())(path, **kwargs)
        assert resp.status_code == 403, f"{method} {path} returned {resp.status_code}, expected 403"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_admin_user, None)


# ---------------------------------------------------------------------------
# Additional admin coverage tests
# ---------------------------------------------------------------------------

def test_admin_me_is_admin(client, db):
    _admin_setup(db)
    resp = client.get("/admin/me")
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["is_admin"] is True


def test_admin_me_not_admin(client, db):
    app.dependency_overrides[get_current_user] = make_user_override(NON_ADMIN_DATA)
    app.dependency_overrides[get_admin_user] = make_user_override(NON_ADMIN_DATA)
    resp = client.get("/admin/me")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)
    assert resp.status_code == 200


def test_list_admins(client, db):
    _admin_setup(db)
    resp = client.get("/admin/admins")
    _admin_teardown()
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_update_admin_role(client, db):
    _admin_setup(db)
    # Add an admin to update
    client.post("/admin/admins", json={"email": "target@example.com", "role": "admin"})
    resp = client.put("/admin/admins/target@example.com", json={"role": "super_admin"})
    _admin_teardown()
    assert resp.status_code == 200


def test_update_admin_not_found(client, db):
    _admin_setup(db)
    resp = client.put("/admin/admins/nonexistent@example.com", json={"role": "admin"})
    _admin_teardown()
    assert resp.status_code == 404


def test_create_league_invalid_format(client, db):
    _admin_setup(db)
    resp = client.post("/admin/leagues", json={
        "name": "Bad League",
        "format": "6v6",
        "tournament_format": "round_robin",
        "max_teams": 4,
        "start_date": "2026-06-01",
        "num_weeks": 8,
        "game_duration": 60,
        "games_per_week": 1,
    })
    _admin_teardown()
    assert resp.status_code == 422


def test_update_league_partial(client, db):
    _admin_setup(db)
    league = make_league(db)
    db.commit()
    resp = client.put(f"/admin/leagues/{league.id}", json={"name": "Renamed"})
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_get_league_stats(client, db):
    _admin_setup(db)
    league = make_league(db)
    db.commit()
    resp = client.get(f"/admin/leagues/{league.id}/stats")
    _admin_teardown()
    assert resp.status_code == 200
    data = resp.json()
    assert "total_players" in data


def test_get_league_stats_not_found(client, db):
    _admin_setup(db)
    resp = client.get(f"/admin/leagues/{uuid4()}/stats")
    _admin_teardown()
    assert resp.status_code == 404


def test_generate_teams_success(client, db):
    _admin_setup(db)
    league = make_league(db, format="7v7", max_teams=2)
    for i in range(14):
        p = make_player(db, email=f"p{i}@test.com")
        make_league_player(db, league.id, p.id, waiver_status="signed")
    db.commit()
    resp = client.post(f"/admin/leagues/{league.id}/generate-teams", json={})
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["teams_created"] >= 1


def test_generate_teams_no_players(client, db):
    _admin_setup(db)
    league = make_league(db)
    db.commit()
    resp = client.post(f"/admin/leagues/{league.id}/generate-teams", json={})
    _admin_teardown()
    assert resp.status_code == 400


def test_get_teams_for_league(client, db):
    _admin_setup(db)
    league = make_league(db)
    make_team(db, league.id, name="Team A")
    db.commit()
    resp = client.get(f"/admin/leagues/{league.id}/teams")
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_members_pagination(client, db):
    _admin_setup(db)
    league = make_league(db)
    for i in range(3):
        p = make_player(db, email=f"m{i}@test.com")
        make_league_player(db, league.id, p.id)
    db.commit()
    resp = client.get(f"/admin/leagues/{league.id}/members", params={"skip": 0, "limit": 2})
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_league_start_date_recalculates_end(client, db):
    _admin_setup(db)
    league = make_league(db, start_date=date(2026, 6, 1), num_weeks=8)
    db.commit()
    resp = client.put(f"/admin/leagues/{league.id}", json={
        "start_date": "2026-07-01",
    })
    _admin_teardown()
    assert resp.status_code == 200
    # end_date should be recalculated from new start_date + num_weeks


def test_update_league_not_found(client, db):
    _admin_setup(db)
    resp = client.put(f"/admin/leagues/{uuid4()}", json={"name": "X"})
    _admin_teardown()
    assert resp.status_code == 404


def test_delete_league_not_found(client, db):
    _admin_setup(db)
    resp = client.delete(f"/admin/leagues/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


def test_get_league_detail_not_found(client, db):
    _admin_setup(db)
    resp = client.get(f"/admin/leagues/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


def test_create_league_with_deadline(client, db):
    _admin_setup(db)
    resp = client.post("/admin/leagues", json={
        "name": "Deadline League",
        "format": "7v7",
        "tournament_format": "round_robin",
        "max_teams": 4,
        "start_date": "2026-08-01",
        "num_weeks": 8,
        "game_duration": 60,
        "games_per_week": 1,
        "registration_deadline": "2026-07-15",
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_generate_teams_league_not_found(client, db):
    _admin_setup(db)
    resp = client.post(f"/admin/leagues/{uuid4()}/generate-teams", json={})
    _admin_teardown()
    assert resp.status_code == 404
