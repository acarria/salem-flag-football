"""Integration tests for schedule management endpoints."""
from datetime import date, time
from uuid import uuid4

from app.main import app
from app.utils.clerk_jwt import get_current_user
from app.api.admin.dependencies import get_admin_user
from app.services.schedule_service import (
    calculate_team_standings,
    get_available_time_slots_for_date,
    generate_time_slots_from_availability,
)
from tests.conftest import (
    make_field, make_field_availability, make_game, make_league,
    make_league_field, make_team, make_user_override,
)

ADMIN = {"id": "admin_clerk", "email": "admin@example.com"}


def _admin_setup():
    app.dependency_overrides[get_current_user] = make_user_override(ADMIN)
    app.dependency_overrides[get_admin_user] = make_user_override(ADMIN)


def _admin_teardown():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_admin_user, None)


# ---------------------------------------------------------------------------
# calculate_team_standings (unit-style, uses db directly)
# ---------------------------------------------------------------------------

def test_standings_no_games(db):
    league = make_league(db)
    result = calculate_team_standings(league.id, db)
    assert result == []


def test_standings_basic(db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="Team A")
    t2 = make_team(db, league.id, name="Team B")
    # Team A wins game 1
    make_game(db, league.id, t1.id, t2.id, week=1,
              status="completed", team1_score=21, team2_score=14, winner_id=t1.id)
    # Team B wins game 2
    make_game(db, league.id, t1.id, t2.id, week=2,
              status="completed", team1_score=7, team2_score=10, winner_id=t2.id)
    standings = calculate_team_standings(league.id, db)
    assert len(standings) == 2
    # Both have 1 win, 1 loss => sorted by PF
    for team_id, stats in standings:
        assert stats["wins"] == 1
        assert stats["losses"] == 1


def test_standings_ignores_non_completed(db):
    league = make_league(db)
    t1 = make_team(db, league.id)
    t2 = make_team(db, league.id, name="T2")
    make_game(db, league.id, t1.id, t2.id, status="scheduled")
    standings = calculate_team_standings(league.id, db)
    assert standings == []


def test_standings_ranking_order(db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="Winner")
    t2 = make_team(db, league.id, name="Loser")
    make_game(db, league.id, t1.id, t2.id, status="completed",
              team1_score=21, team2_score=0, winner_id=t1.id)
    make_game(db, league.id, t1.id, t2.id, week=2, status="completed",
              team1_score=14, team2_score=7, winner_id=t1.id)
    standings = calculate_team_standings(league.id, db)
    assert standings[0][0] == t1.id
    assert standings[0][1]["wins"] == 2
    assert standings[1][0] == t2.id
    assert standings[1][1]["losses"] == 2


# ---------------------------------------------------------------------------
# generate_time_slots_from_availability (pure function)
# ---------------------------------------------------------------------------

def test_generate_time_slots_basic():
    slots = generate_time_slots_from_availability(time(18, 0), time(21, 0), 60)
    assert slots == ["18:00", "19:00", "20:00"]


def test_generate_time_slots_with_buffer():
    slots = generate_time_slots_from_availability(time(18, 0), time(21, 0), 60, buffer_minutes=15)
    assert slots == ["18:00", "19:15"]


def test_generate_time_slots_window_too_short():
    slots = generate_time_slots_from_availability(time(18, 0), time(18, 30), 60)
    assert slots == []


def test_generate_time_slots_caps_duration():
    # Duration > 60 should be capped at 60
    slots = generate_time_slots_from_availability(time(18, 0), time(21, 0), 90)
    assert slots == ["18:00", "19:00", "20:00"]


# ---------------------------------------------------------------------------
# POST /admin/leagues/{id}/generate-schedule
# ---------------------------------------------------------------------------

def test_generate_schedule_round_robin(client, db):
    league = make_league(db, num_weeks=3, tournament_format="round_robin")
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    t3 = make_team(db, league.id, name="T3")
    t4 = make_team(db, league.id, name="T4")
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={
        "time_slots": ["18:00", "19:00"],
    })
    _admin_teardown()
    assert resp.status_code == 200
    data = resp.json()
    assert data["games_created"] > 0
    assert data["weeks_scheduled"] == 3


def test_generate_schedule_with_field_availability(client, db):
    league = make_league(db, num_weeks=1, start_date=date(2026, 6, 1))
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    # Monday availability matching start_date (2026-06-01 is a Monday)
    make_field_availability(db, field.id, day_of_week=0,
                           recurrence_start_date=date(2026, 1, 1))
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={})
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["games_created"] >= 1


def test_generate_schedule_too_few_teams(client, db):
    league = make_league(db)
    make_team(db, league.id)
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={
        "time_slots": ["18:00"],
    })
    _admin_teardown()
    assert resp.status_code == 400


def test_generate_schedule_league_not_found(client, db):
    _admin_setup()
    resp = client.post(f"/admin/leagues/{uuid4()}/generate-schedule", json={
        "time_slots": ["18:00"],
    })
    _admin_teardown()
    assert resp.status_code == 404


def test_generate_schedule_deactivates_old(client, db):
    league = make_league(db, num_weeks=1)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    old_game = make_game(db, league.id, t1.id, t2.id)
    old_id = old_game.id
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={
        "time_slots": ["18:00"],
    })
    _admin_teardown()
    assert resp.status_code == 200
    db.refresh(old_game)
    assert old_game.is_active is False


def test_generate_schedule_odd_teams_bye(client, db):
    league = make_league(db, num_weeks=1)
    make_team(db, league.id, name="T1")
    make_team(db, league.id, name="T2")
    make_team(db, league.id, name="T3")
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={
        "time_slots": ["18:00"],
    })
    _admin_teardown()
    assert resp.status_code == 200
    # 3 teams → 1 game per week (one team has bye)
    assert resp.json()["games_created"] == 1


def test_generate_schedule_swiss_returns_501(client, db):
    """Swiss tournament scheduling is not yet implemented — should return 501."""
    league = make_league(db, num_weeks=1, tournament_format="swiss")
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    _admin_setup()
    resp = client.post(f"/admin/leagues/{league.id}/generate-schedule", json={
        "time_slots": ["18:00"],
    })
    _admin_teardown()
    assert resp.status_code == 501


# ---------------------------------------------------------------------------
# GET /admin/leagues/{id}/schedule
# ---------------------------------------------------------------------------

def test_get_admin_schedule(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/schedule")
    _admin_teardown()
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_games"] == 1
    assert "1" in data["schedule_by_week"]


def test_get_admin_schedule_empty(client, db):
    league = make_league(db)
    _admin_setup()
    resp = client.get(f"/admin/leagues/{league.id}/schedule")
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["total_games"] == 0


def test_get_admin_schedule_not_found(client, db):
    _admin_setup()
    resp = client.get(f"/admin/leagues/{uuid4()}/schedule")
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /admin/leagues/{id}/games/{game_id}
# ---------------------------------------------------------------------------

def test_update_game_scores(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "team1_score": 21,
        "team2_score": 14,
    })
    _admin_teardown()
    assert resp.status_code == 200
    data = resp.json()
    assert data["team1_score"] == 21
    assert data["team2_score"] == 14
    assert data["winner_id"] == str(t1.id)
    assert data["status"] == "completed"


def test_update_game_tie(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "team1_score": 14,
        "team2_score": 14,
    })
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["winner_id"] is None


def test_update_game_explicit_status(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "status": "cancelled",
    })
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_update_game_reschedule(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "game_date": "2026-07-15",
        "game_time": "19:30",
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_update_game_explicit_winner(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "winner_id": str(t2.id),
    })
    _admin_teardown()
    assert resp.status_code == 200
    assert resp.json()["winner_id"] == str(t2.id)


def test_update_game_field_id(client, db):
    league = make_league(db)
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    game = make_game(db, league.id, t1.id, t2.id)
    field = make_field(db)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{game.id}", json={
        "field_id": str(field.id),
    })
    _admin_teardown()
    assert resp.status_code == 200


def test_update_game_not_found(client, db):
    league = make_league(db)
    _admin_setup()
    resp = client.put(f"/admin/leagues/{league.id}/games/{uuid4()}", json={
        "status": "cancelled",
    })
    _admin_teardown()
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# get_available_time_slots_for_date (integration-style, uses real DB)
# ---------------------------------------------------------------------------

def test_available_slots_no_fields(db):
    league = make_league(db)
    result = get_available_time_slots_for_date(league.id, date(2026, 6, 1), db)
    assert result == []


def test_available_slots_recurring(db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    # Monday availability
    make_field_availability(db, field.id, day_of_week=0,
                           recurrence_start_date=date(2026, 1, 1))
    db.flush()
    # 2026-06-01 is a Monday
    result = get_available_time_slots_for_date(league.id, date(2026, 6, 1), db)
    assert len(result) >= 1
    assert result[0][0] == field.id


def test_available_slots_wrong_day(db):
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    # Tuesday availability
    make_field_availability(db, field.id, day_of_week=1,
                           recurrence_start_date=date(2026, 1, 1))
    db.flush()
    # 2026-06-01 is Monday — should not match Tuesday availability
    result = get_available_time_slots_for_date(league.id, date(2026, 6, 1), db)
    assert result == []


def test_available_slots_with_booking_conflict(db):
    from datetime import time as t
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    make_field_availability(db, field.id, day_of_week=0,
                           start_time=t(18, 0), end_time=t(19, 0),
                           recurrence_start_date=date(2026, 1, 1))
    t1 = make_team(db, league.id, name="T1")
    t2 = make_team(db, league.id, name="T2")
    # Book a game at this exact slot
    make_game(db, league.id, t1.id, t2.id, game_date=date(2026, 6, 1),
              game_time="18:00", field_id=field.id)
    db.flush()
    result = get_available_time_slots_for_date(league.id, date(2026, 6, 1), db)
    assert result == []  # Slot is booked


def test_available_slots_custom_date(db):
    from datetime import time as t
    league = make_league(db)
    field = make_field(db)
    make_league_field(db, league.id, field.id)
    make_field_availability(db, field.id, is_recurring=False, day_of_week=None,
                           custom_date=date(2026, 7, 4),
                           start_time=t(10, 0), end_time=t(14, 0))
    db.flush()
    result = get_available_time_slots_for_date(league.id, date(2026, 7, 4), db)
    assert len(result) >= 1


def test_available_slots_with_field_filter(db):
    league = make_league(db)
    f1 = make_field(db, name="F1")
    f2 = make_field(db, name="F2")
    make_league_field(db, league.id, f1.id)
    make_league_field(db, league.id, f2.id)
    make_field_availability(db, f1.id, day_of_week=0,
                           recurrence_start_date=date(2026, 1, 1))
    make_field_availability(db, f2.id, day_of_week=0,
                           recurrence_start_date=date(2026, 1, 1))
    db.flush()
    result = get_available_time_slots_for_date(league.id, date(2026, 6, 1), db, field_id=f1.id)
    assert all(slot[0] == f1.id for slot in result)
