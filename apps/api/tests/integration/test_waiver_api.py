"""Integration tests for waiver API endpoints."""

from datetime import datetime, timedelta, timezone

from tests.conftest import (
    make_league,
    make_league_player,
    make_player,
    make_waiver,
    make_waiver_signature,
)


class TestGetActiveWaiver:
    def test_returns_active_waiver(self, client, db):
        waiver = make_waiver(db, version="2025-v1", content="Full waiver text.")
        resp = client.get("/waiver/active")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == "2025-v1"
        assert data["content"] == "Full waiver text."

    def test_404_when_no_active(self, client, db):
        make_waiver(db, is_active=False)
        resp = client.get("/waiver/active")
        assert resp.status_code == 404


class TestSignWaiver:
    def test_sign_success(self, client, db, override_auth):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )

        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test Player",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "signed_at" in data
        assert data["waiver_version"] == "2025-v1"

    def test_sign_unauthenticated(self, client, db):
        waiver = make_waiver(db)
        league = make_league(db)
        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test",
        })
        assert resp.status_code == 401

    def test_sign_duplicate(self, client, db, override_auth):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )
        make_waiver_signature(db, waiver.id, player.id, league.id)

        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test Player",
        })
        assert resp.status_code == 409

    def test_sign_expired_deadline(self, client, db, override_auth):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test Player",
        })
        assert resp.status_code == 400


    def test_sign_inactive_waiver(self, client, db, override_auth):
        waiver = make_waiver(db, is_active=False)
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )

        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test Player",
        })
        assert resp.status_code == 422

    def test_sign_not_registered(self, client, db, override_auth):
        waiver = make_waiver(db)
        league = make_league(db)
        make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        # No league_player created — player is not registered

        resp = client.post("/waiver/sign", json={
            "waiver_id": str(waiver.id),
            "league_id": str(league.id),
            "full_name_typed": "Test Player",
        })
        assert resp.status_code == 404


class TestWaiverStatus:
    def test_signed_status(self, client, db, override_auth):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(db, league.id, player.id)
        make_waiver_signature(db, waiver.id, player.id, league.id)

        resp = client.get(f"/waiver/status?league_id={league.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["signed"] is True
        assert data["waiver_version"] == "2025-v1"

    def test_pending_status(self, client, db, override_auth):
        league = make_league(db)
        player = make_player(db, clerk_user_id=override_auth["id"], email=override_auth["email"])
        make_league_player(db, league.id, player.id)

        resp = client.get(f"/waiver/status?league_id={league.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["signed"] is False


class TestAdminWaivers:
    def test_list_signatures(self, client, db, override_admin):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db, first_name="Alice", last_name="Smith")
        make_waiver_signature(db, waiver.id, player.id, league.id, full_name_typed="Alice Smith")

        resp = client.get(f"/admin/waivers?league_id={league.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["player_name"] == "Alice Smith"

    def test_list_signatures_forbidden(self, client, db, override_auth):
        league = make_league(db)
        resp = client.get(f"/admin/waivers?league_id={league.id}")
        assert resp.status_code == 403

    def test_create_waiver_version(self, client, db, override_admin):
        make_waiver(db, version="v1")

        resp = client.post("/admin/waivers", json={
            "version": "v2",
            "content": "Updated waiver text.",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["version"] == "v2"
