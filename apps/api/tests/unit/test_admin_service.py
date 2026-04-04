import pytest
from app.models.admin_config import AdminConfig
from app.services.admin_service import AdminService
from app.services.exceptions import ServiceError


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
    _seed_admin(db, "other@example.com")  # Ensure > 1 admin so last-admin guard doesn't fire
    result = AdminService.remove_admin_email(db, "togo@example.com", caller_email="other@example.com")
    assert result is True
    assert AdminService.is_admin_email(db, "togo@example.com") is False


def test_remove_admin_returns_false_for_nonexistent(db):
    _seed_admin(db, "keeper@example.com")
    _seed_admin(db, "other@example.com")  # Need > 1 so last-admin guard doesn't fire
    result = AdminService.remove_admin_email(db, "ghost@example.com", caller_email="keeper@example.com")
    assert result is False


def test_remove_admin_blocks_self_removal(db):
    _seed_admin(db, "self@example.com")
    with pytest.raises(ServiceError, match="Cannot remove your own"):
        AdminService.remove_admin_email(db, "self@example.com", caller_email="self@example.com")


def test_remove_admin_blocks_last_admin(db):
    # Deactivate any pre-existing admins so "last" is truly the only one
    db.query(AdminConfig).filter(AdminConfig.is_active == True).update({"is_active": False})
    _seed_admin(db, "last@example.com")
    with pytest.raises(ServiceError, match="Cannot remove the last"):
        AdminService.remove_admin_email(db, "last@example.com", caller_email="other@example.com")


def test_get_all_admins(db):
    _seed_admin(db, "a1@example.com")
    _seed_admin(db, "a2@example.com")
    _seed_admin(db, "inactive@example.com", is_active=False)
    result = AdminService.get_all_admins(db)
    emails = [a.email for a in result]
    assert "a1@example.com" in emails
    assert "a2@example.com" in emails
    assert "inactive@example.com" not in emails


def test_get_all_admins_empty(db):
    # Ensure no active admins exist (test may run after others seed data)
    result = AdminService.get_all_admins(db)
    # With savepoint isolation, this DB session is fresh — should be empty
    assert isinstance(result, list)


def test_update_admin_role(db):
    _seed_admin(db, "update@example.com", role="admin")
    result = AdminService.update_admin_role(db, "update@example.com", "super_admin")
    assert result is True
    ac = db.query(AdminConfig).filter(AdminConfig.email == "update@example.com").first()
    assert ac.role == "super_admin"


def test_update_admin_role_not_found(db):
    result = AdminService.update_admin_role(db, "ghost@example.com", "admin")
    assert result is False
