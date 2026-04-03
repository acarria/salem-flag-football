import pytest

# conftest sets env vars before import
from app.services.league_service import get_player_cap, get_occupied_spots
from tests.conftest import make_league, make_player, make_league_player, make_group_invitation, make_group


def test_player_cap_7v7():
    assert get_player_cap("7v7", 4) == 28


def test_player_cap_5v5():
    assert get_player_cap("5v5", 6) == 30


def test_player_cap_none_when_uncapped():
    assert get_player_cap("7v7", None) is None


def test_player_cap_raises_for_unknown_format():
    with pytest.raises(ValueError, match="Unknown league format"):
        get_player_cap("6v6", 4)


def test_occupied_spots_confirmed_plus_pending(db):
    league = make_league(db)
    organizer = make_player(db)

    # 5 confirmed players
    for _ in range(5):
        p = make_player(db)
        make_league_player(db, league.id, p.id, status="confirmed")

    # group for invitations
    group = make_group(db, league.id, organizer.id)

    # 3 non-expired pending invitations
    for _ in range(3):
        make_group_invitation(db, group.id, league.id, organizer.id, expires_future=True)

    db.flush()
    assert get_occupied_spots(league.id, db) == 8


def test_occupied_spots_ignores_expired_invitations(db):
    league = make_league(db)
    organizer = make_player(db)
    p = make_player(db)
    make_league_player(db, league.id, p.id, status="confirmed")
    group = make_group(db, league.id, organizer.id)
    make_group_invitation(db, group.id, league.id, organizer.id, expires_future=False)
    db.flush()
    assert get_occupied_spots(league.id, db) == 1  # only the confirmed player


def test_occupied_spots_zero_empty_league(db):
    league = make_league(db)
    assert get_occupied_spots(league.id, db) == 0
