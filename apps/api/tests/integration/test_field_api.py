"""Integration tests for field management endpoints (field_management.py)."""
from uuid import uuid4

from app.main import app
from app.utils.clerk_jwt import get_current_user
from app.api.admin.dependencies import get_admin_user
from tests.conftest import (
    make_field, make_field_availability, make_league, make_league_field, make_user_override,
)

ADMIN = {"id": "admin_clerk", "email": "admin@example.com"}

FIELD_DATA = {
    "name": "Main Field",
    "street_address": "123 Main St",
    "city": "Salem",
    "state": "MA",
    "zip_code": "01970",
    "country": "USA",
}


def _admin_setup():
    from app.models.admin_config import AdminConfig
    app.dependency_overrides[get_current_user] = make_user_override(ADMIN)
    app.dependency_overrides[get_admin_user] = make_user_override(ADMIN)


def _admin_teardown():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)


# ---------------------------------------------------------------------------
# Global field CRUD
# ---------------------------------------------------------------------------

def test_create_field_global(client, db):
    _admin_setup()
    resp = client.post("/admin/fields", json=FIELD_DATA)
    _admin_teardown()
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Main Field"
    assert data["city"] == "Salem"
    assert data["is_active"] is True


def test_get_all_fields(client, db):
    make_field(db, name="Field A")
    make_field(db, name="Field B")
    db.flush()
    _admin_setup()
    resp = client.get("/admin/fields")
    _admin_teardown()
    assert resp.status_code == 200
    names = [f["name"] for f in resp.json()]
    assert "Field A" in names
    assert "Field B" in names


def test_get_all_fields_filter_active(client, db):
    make_field(db, name="Active", is_active=True)
    make_field(db, name="Inactive", is_active=False)
    db.flush()
    _admin_setup()
    resp = client.get("/admin/fields", params={"is_active": True})
    _admin_teardown()
    assert resp.status_code == 200
    names = [f["name"] for f in resp.json()]
    assert "Active" in names
    assert "Inactive" not in names


def test_get_field_by_id(client, db):
    field = make_field(db, name="Lookup Field")
    _admin_setup()
    resp = client.get(f"/admin/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["name"] == "Lookup Field"


def test_get_field_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/fields/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_field(client, db):
    field = make_field(db, name="Old Name")
    _admin_setup()
    resp = client.put(f"/admin/fields/{field.id}", json={"name": "New Name"})
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_update_field_not_found(client, db):
    _admin_setup()
    resp = client.put(f"/admin/fields/{uuid4()}", json={"name": "X"})
    _admin_teardown()
    assert resp.status_code == 404


def test_delete_field_soft(client, db):
    field = make_field(db, name="To Delete")
    _admin_setup()
    resp = client.delete(f"/admin/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200
    db.refresh(field)
    assert field.is_active is False


def test_delete_field_not_found(client, db):
    _admin_setup()
    resp = client.delete(f"/admin/fields/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# League-field association
# ---------------------------------------------------------------------------

def test_associate_field_with_league(client, db):
    league = make_league(db)
    field = make_field(db)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200


def test_associate_field_duplicate(client, db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 400


def test_associate_field_league_not_found(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{uuid4()}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 404


def test_disassociate_field(client, db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.delete(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200


def test_disassociate_field_not_associated(client, db):
    league = make_league(db)
    field = make_field(db)
    _admin_setup()
    resp = client.delete(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# League-scoped field CRUD
# ---------------------------------------------------------------------------

def test_create_field_for_league(client, db):
    league = make_league(db)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/fields", json=FIELD_DATA)
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["name"] == "Main Field"


def test_create_field_for_league_not_found(client, db):
    _admin_setup()
    resp = client.post(f"/admin/leagues/{uuid4()}/fields", json=FIELD_DATA)
    _admin_teardown()
    assert resp.status_code == 404


def test_get_league_fields(client, db):
    league = make_league(db)
    field = make_field(db, name="League Field")
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/fields")
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["name"] == "League Field"


def test_get_league_fields_empty(client, db):
    league = make_league(db)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/fields")
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_league_field_by_id(client, db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200


def test_get_league_field_not_associated(client, db):
    league = make_league(db)
    field = make_field(db)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_league_field(client, db):
    league = make_league(db)
    field = make_field(db, name="Old")
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/fields/{field.id}", json={"name": "Updated"})
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


def test_delete_league_field_disassociates(client, db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    _admin_setup()
    resp = client.delete(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 200
    # Field still exists, just disassociated
    db.refresh(field)
    assert field.is_active is True


# ---------------------------------------------------------------------------
# Field availability (global)
# ---------------------------------------------------------------------------

def test_create_field_availability_recurring(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.post("/admin/field-availability", json={
        "field_id": str(field.id),
        "is_recurring": True,
        "day_of_week": 1,
        "recurrence_start_date": "2026-06-01",
        "start_time": "18:00:00",
        "end_time": "21:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["is_recurring"] is True
    assert resp.json()["field_name"] == field.name


def test_create_field_availability_one_time(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.post("/admin/field-availability", json={
        "field_id": str(field.id),
        "is_recurring": False,
        "custom_date": "2026-07-04",
        "start_time": "10:00:00",
        "end_time": "14:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["is_recurring"] is False


def test_create_field_availability_field_not_found(client, db):
    _admin_setup()
    resp = client.post("/admin/field-availability", json={
        "field_id": str(uuid4()),
        "is_recurring": False,
        "custom_date": "2026-07-04",
        "start_time": "10:00:00",
        "end_time": "14:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 404


def test_get_all_field_availability(client, db):
    field = make_field(db)
    make_field_availability(db, field.id)
    _admin_setup()
    resp = client.get("/admin/field-availability")
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_get_all_field_availability_filter_by_field(client, db):
    f1 = make_field(db, name="F1")
    f2 = make_field(db, name="F2")
    make_field_availability(db, f1.id)
    make_field_availability(db, f2.id)
    _admin_setup()
    resp = client.get("/admin/field-availability", params={"field_id": str(f1.id)})
    _admin_teardown()
    assert resp.status_code == 200
    assert all(a["field_id"] == str(f1.id) for a in resp.json())


def test_get_league_field_availability(client, db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    make_field_availability(db, field.id)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/field-availability")
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_get_league_field_availability_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/leagues/{uuid4()}/field-availability")
    _admin_teardown()
    assert resp.status_code == 404


def test_get_field_availability_by_id(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.get(f"/admin/field-availability/{fa.id}")
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["field_name"] == field.name


def test_get_field_availability_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/field-availability/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_field_availability(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.put(f"/admin/field-availability/{fa.id}", json={
        "start_time": "17:00:00",
        "end_time": "20:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_update_field_availability_bad_times(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.put(f"/admin/field-availability/{fa.id}", json={
        "start_time": "20:00:00",
        "end_time": "18:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 400


def test_update_field_availability_not_found(client, db):
    _admin_setup()
    resp = client.put(f"/admin/field-availability/{uuid4()}", json={"notes": "x"})
    _admin_teardown()
    assert resp.status_code == 404


def test_delete_field_availability(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.delete(f"/admin/field-availability/{fa.id}")
    _admin_teardown()
    assert resp.status_code == 200
    db.refresh(fa)
    assert fa.is_active is False


def test_delete_field_availability_not_found(client, db):
    _admin_setup()
    resp = client.delete(f"/admin/field-availability/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Field-scoped availability CRUD
# ---------------------------------------------------------------------------

def test_create_scoped_availability(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.post(f"/admin/fields/{field.id}/availability", json={
        "field_id": str(field.id),
        "is_recurring": True,
        "day_of_week": 2,
        "recurrence_start_date": "2026-06-01",
        "start_time": "18:00:00",
        "end_time": "21:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_create_scoped_availability_field_not_found(client, db):
    _admin_setup()
    fid = uuid4()
    resp = client.post(f"/admin/fields/{fid}/availability", json={
        "field_id": str(fid),
        "is_recurring": False,
        "custom_date": "2026-07-04",
        "start_time": "10:00:00",
        "end_time": "14:00:00",
    })
    _admin_teardown()
    assert resp.status_code == 404


def test_get_scoped_availability(client, db):
    field = make_field(db)
    make_field_availability(db, field.id)
    _admin_setup()
    resp = client.get(f"/admin/fields/{field.id}/availability")
    _admin_teardown()
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_get_scoped_availability_field_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/fields/{uuid4()}/availability")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_scoped_availability(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.put(f"/admin/fields/{field.id}/availability/{fa.id}", json={"notes": "Updated"})
    _admin_teardown()
    assert resp.status_code == 200


def test_update_scoped_availability_not_found(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.put(f"/admin/fields/{field.id}/availability/{uuid4()}", json={"notes": "x"})
    _admin_teardown()
    assert resp.status_code == 404


def test_delete_scoped_availability(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.delete(f"/admin/fields/{field.id}/availability/{fa.id}")
    _admin_teardown()
    assert resp.status_code == 200
    db.refresh(fa)
    assert fa.is_active is False


def test_delete_scoped_availability_not_found(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.delete(f"/admin/fields/{field.id}/availability/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Additional coverage for 404/error paths
# ---------------------------------------------------------------------------

def test_associate_field_not_active(client, db):
    league = make_league(db)
    field = make_field(db, is_active=False)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_field_availability_change_field(client, db):
    f1 = make_field(db, name="F1")
    f2 = make_field(db, name="F2")
    fa = make_field_availability(db, f1.id)
    _admin_setup()
    resp = client.put(f"/admin/field-availability/{fa.id}", json={
        "field_id": str(f2.id),
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_update_field_availability_invalid_field(client, db):
    field = make_field(db)
    fa = make_field_availability(db, field.id)
    _admin_setup()
    resp = client.put(f"/admin/field-availability/{fa.id}", json={
        "field_id": str(uuid4()),
    })
    _admin_teardown()
    assert resp.status_code == 404


def test_delete_league_field_league_not_found(client, db):
    field = make_field(db)
    _admin_setup()
    resp = client.delete(f"/admin/leagues/{uuid4()}/fields/{field.id}")
    _admin_teardown()
    assert resp.status_code == 404


def test_update_league_field_league_not_found(client, db):
    _admin_setup()
    resp = client.put(f"/admin/leagues/{uuid4()}/fields/{uuid4()}", json={"name": "X"})
    _admin_teardown()
    assert resp.status_code == 404


def test_update_league_field_field_not_found(client, db):
    league = make_league(db)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/fields/{uuid4()}", json={"name": "X"})
    _admin_teardown()
    assert resp.status_code == 404


def test_get_league_fields_league_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/leagues/{uuid4()}/fields")
    _admin_teardown()
    assert resp.status_code == 404


def test_get_league_field_league_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/leagues/{uuid4()}/fields/{uuid4()}")
    _admin_teardown()
    assert resp.status_code == 404


def test_create_field_for_league_league_not_found_check(client, db):
    """Duplicate of test_create_field_for_league_not_found but ensures coverage."""
    _admin_setup()
    resp = client.post(f"/admin/leagues/{uuid4()}/fields", json=FIELD_DATA)
    _admin_teardown()
    assert resp.status_code == 404
