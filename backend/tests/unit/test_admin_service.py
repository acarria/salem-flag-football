import pytest
from tests.conftest import make_player
from app.models.admin_config import AdminConfig
from app.services.admin_service import AdminService


def _seed_admin(db, email, is_active=True, role="admin") -> AdminConfig:
    ac = AdminConfig(email=email.lower(), is_active=is_active, role=role)
    db.add(ac)
    db.flush()
    return ac


def test_is_admin_true_for_active_admin(db):
    _seed_admin(db, "boss@example.com")
    assert AdminService.is_admin_email(db, "boss@example.com") is True


def test_is_admin_case_insensitive(db):
    _seed_admin(db, "boss@example.com")
    assert AdminService.is_admin_email(db, "BOSS@EXAMPLE.COM") is True


def test_is_admin_false_for_inactive(db):
    _seed_admin(db, "inactive@example.com", is_active=False)
    assert AdminService.is_admin_email(db, "inactive@example.com") is False


def test_is_admin_false_for_unknown(db):
    assert AdminService.is_admin_email(db, "nobody@example.com") is False


def test_add_admin_stores_lowercase(db):
    ac = AdminService.add_admin_email(db, "NewAdmin@EXAMPLE.COM")
    assert ac.email == "newadmin@example.com"
    assert ac.is_active is True


def test_remove_admin_soft_deletes(db):
    _seed_admin(db, "togo@example.com")
    result = AdminService.remove_admin_email(db, "togo@example.com")
    assert result is True
    assert AdminService.is_admin_email(db, "togo@example.com") is False


def test_remove_admin_returns_false_for_nonexistent(db):
    result = AdminService.remove_admin_email(db, "ghost@example.com")
    assert result is False
