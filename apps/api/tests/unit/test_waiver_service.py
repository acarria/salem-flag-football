"""Unit tests for waiver_service.py — uses the test DB with savepoint isolation."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.waiver_service import (
    create_waiver_version,
    expire_overdue_waivers,
    expire_unsigned_for_league,
    get_active_waiver,
    get_signatures_for_league,
    get_waiver_status,
    has_pending_waivers,
    sign_waiver,
)
from app.services.exceptions import ConflictError, NotFoundError, ServiceError
from tests.conftest import make_league, make_league_player, make_player, make_waiver, make_waiver_signature


class TestGetActiveWaiver:
    def test_returns_active(self, db):
        make_waiver(db, is_active=False, version="old")
        active = make_waiver(db, is_active=True, version="current")
        result = get_active_waiver(db)
        assert result is not None
        assert result.id == active.id

    def test_returns_none_when_none_active(self, db):
        make_waiver(db, is_active=False)
        assert get_active_waiver(db) is None


class TestSignWaiver:
    def test_success(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db)
        lp = make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )

        sig = sign_waiver(db, player.id, league.id, waiver.id, "Test Player", "1.2.3.4", "pytest")
        assert sig.full_name_typed == "Test Player"
        assert lp.waiver_status == "signed"

    def test_duplicate_raises_conflict(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db)
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )

        sign_waiver(db, player.id, league.id, waiver.id, "Test Player", None, None)

        with pytest.raises(ConflictError, match="already signed"):
            sign_waiver(db, player.id, league.id, waiver.id, "Test Player", None, None)

    def test_stale_waiver_raises(self, db):
        waiver = make_waiver(db, is_active=False)
        league = make_league(db)
        player = make_player(db)
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=7),
        )

        with pytest.raises(ServiceError, match="no longer active"):
            sign_waiver(db, player.id, league.id, waiver.id, "Test", None, None)

    def test_expired_deadline_raises(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db)
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        with pytest.raises(ServiceError, match="expired"):
            sign_waiver(db, player.id, league.id, waiver.id, "Test", None, None)

    def test_not_registered_raises(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db)

        with pytest.raises(NotFoundError, match="not registered"):
            sign_waiver(db, player.id, league.id, waiver.id, "Test", None, None)


class TestGetWaiverStatus:
    def test_signed(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        player = make_player(db)
        make_league_player(db, league.id, player.id)
        make_waiver_signature(db, waiver.id, player.id, league.id)

        status = get_waiver_status(db, player.id, league.id)
        assert status.signed is True
        assert status.waiver_version == "2025-v1"

    def test_not_signed(self, db):
        league = make_league(db)
        player = make_player(db)
        make_league_player(db, league.id, player.id)

        status = get_waiver_status(db, player.id, league.id)
        assert status.signed is False


class TestCreateWaiverVersion:
    def test_deactivates_previous(self, db):
        old = make_waiver(db, version="v1", is_active=True)
        new = create_waiver_version(db, "v2", "New content")

        db.refresh(old)
        assert old.is_active is False
        assert new.is_active is True
        assert new.version == "v2"


class TestExpireOverdueWaivers:
    def test_expires_overdue(self, db):
        league = make_league(db)
        player = make_player(db)
        lp = make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        affected = expire_overdue_waivers(db)
        assert league.id in affected
        assert affected[league.id] == 1
        db.refresh(lp)
        assert lp.registration_status == "expired"
        assert lp.waiver_status == "expired"
        assert lp.is_active is False

    def test_leaves_signed_alone(self, db):
        league = make_league(db)
        player = make_player(db)
        lp = make_league_player(
            db, league.id, player.id,
            waiver_status="signed",
            waiver_deadline=datetime.now(timezone.utc) - timedelta(hours=1),
        )

        affected = expire_overdue_waivers(db)
        assert len(affected) == 0
        db.refresh(lp)
        assert lp.is_active is True

    def test_leaves_future_deadline_alone(self, db):
        league = make_league(db)
        player = make_player(db)
        lp = make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=3),
        )

        affected = expire_overdue_waivers(db)
        assert len(affected) == 0
        db.refresh(lp)
        assert lp.is_active is True


class TestExpireUnsignedForLeague:
    def test_expires_for_specific_league(self, db):
        league1 = make_league(db, name="League 1")
        league2 = make_league(db, name="League 2")
        p1 = make_player(db, clerk_user_id="p1")
        p2 = make_player(db, clerk_user_id="p2")
        make_league_player(db, league1.id, p1.id)
        lp2 = make_league_player(db, league2.id, p2.id)

        count = expire_unsigned_for_league(db, league1.id)
        assert count == 1
        db.refresh(lp2)
        assert lp2.is_active is True  # league2 unaffected


class TestHasPendingWaivers:
    def test_pending_within_deadline(self, db):
        league = make_league(db)
        player = make_player(db)
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) + timedelta(days=3),
        )
        assert has_pending_waivers(db, league.id) is True

    def test_all_signed(self, db):
        league = make_league(db)
        player = make_player(db)
        make_league_player(db, league.id, player.id, waiver_status="signed")
        assert has_pending_waivers(db, league.id) is False

    def test_pending_past_deadline(self, db):
        league = make_league(db)
        player = make_player(db)
        make_league_player(
            db, league.id, player.id,
            waiver_deadline=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert has_pending_waivers(db, league.id) is False


class TestGetSignaturesForLeague:
    def test_returns_signatures(self, db):
        waiver = make_waiver(db)
        league = make_league(db)
        p1 = make_player(db, clerk_user_id="p1", first_name="Alice", last_name="Smith")
        p2 = make_player(db, clerk_user_id="p2", first_name="Bob", last_name="Jones")
        make_waiver_signature(db, waiver.id, p1.id, league.id, full_name_typed="Alice Smith")
        make_waiver_signature(db, waiver.id, p2.id, league.id, full_name_typed="Bob Jones")

        sigs = get_signatures_for_league(db, league.id)
        assert len(sigs) == 2
        names = {s.player_name for s in sigs}
        assert "Alice Smith" in names
        assert "Bob Jones" in names
