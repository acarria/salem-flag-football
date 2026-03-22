import pytest
from datetime import date, timedelta
from uuid import uuid4

from tests.conftest import (
    make_league, make_player, make_league_player, make_group, make_group_invitation
)
from app.services.team_generation_service import (
    trigger_team_generation_if_ready, _run_team_generation
)
from app.models.team import Team
from app.models.league_player import LeaguePlayer


def _fill_league(db, league, count):
    """Create `count` confirmed players for the league. Returns list of LeaguePlayers."""
    lps = []
    for _ in range(count):
        p = make_player(db)
        lp = make_league_player(db, league.id, p.id, status="confirmed")
        lps.append(lp)
    return lps


def test_trigger_returns_false_unknown_league(db):
    assert trigger_team_generation_if_ready(uuid4(), db) is False


def test_trigger_returns_false_teams_already_exist(db):
    league = make_league(db, format="7v7", max_teams=2)
    _fill_league(db, league, 14)
    # create an existing active team
    team = Team(league_id=league.id, name="Existing", color="#ff0000", created_by="system")
    db.add(team)
    db.flush()
    assert trigger_team_generation_if_ready(league.id, db) is False


def test_trigger_returns_false_uncapped_league(db):
    league = make_league(db, format="7v7", max_teams=None)
    _fill_league(db, league, 5)
    assert trigger_team_generation_if_ready(league.id, db) is False


def test_trigger_returns_false_not_full_no_deadline(db):
    league = make_league(db, format="7v7", max_teams=2, registration_deadline=None)
    _fill_league(db, league, 5)  # cap is 14, only 5 players
    assert trigger_team_generation_if_ready(league.id, db) is False


def test_trigger_generates_teams_when_full(db):
    league = make_league(db, format="7v7", max_teams=2)
    _fill_league(db, league, 14)  # exactly at cap (14 = 7 * 2)
    result = trigger_team_generation_if_ready(league.id, db)
    assert result is True
    teams = db.query(Team).filter(Team.league_id == league.id, Team.is_active == True).all()
    assert len(teams) >= 1
    assigned = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.team_id != None,
    ).count()
    assert assigned == 14


def test_trigger_generates_when_deadline_passed(db):
    past_deadline = date.today() - timedelta(days=1)
    league = make_league(db, format="7v7", max_teams=2, registration_deadline=past_deadline)
    _fill_league(db, league, 5)  # not full, but deadline passed
    result = trigger_team_generation_if_ready(league.id, db)
    assert result is True


def test_run_keeps_group_together(db):
    league = make_league(db, format="7v7", max_teams=2)
    organizer = make_player(db)
    org_lp = make_league_player(db, league.id, organizer.id, status="confirmed")
    group = make_group(db, league.id, organizer.id)
    org_lp.group_id = group.id

    partner = make_player(db)
    partner_lp = make_league_player(db, league.id, partner.id, status="confirmed")
    partner_lp.group_id = group.id
    db.flush()

    # Fill remaining spots
    _fill_league(db, league, 12)

    _run_team_generation(league, db)

    # Reload
    db.expire_all()
    org_lp_fresh = db.query(LeaguePlayer).get(org_lp.id)
    partner_lp_fresh = db.query(LeaguePlayer).get(partner_lp.id)
    assert org_lp_fresh.team_id == partner_lp_fresh.team_id


def test_run_splits_oversized_group(db):
    """A group larger than players_per_team should be split across teams."""
    league = make_league(db, format="7v7", max_teams=2)  # 7 per team
    organizer = make_player(db)
    group = make_group(db, league.id, organizer.id)

    # Create 8 grouped players (exceeds 7-per-team)
    org_lp = make_league_player(db, league.id, organizer.id, status="confirmed")
    org_lp.group_id = group.id
    for _ in range(7):
        p = make_player(db)
        lp = make_league_player(db, league.id, p.id, status="confirmed")
        lp.group_id = group.id

    # Fill remaining 6 solo spots
    _fill_league(db, league, 6)
    db.flush()

    result = _run_team_generation(league, db)
    # Should complete without error and report a split
    assert result["groups_split"] >= 1


def test_run_deactivates_existing_teams(db):
    league = make_league(db, format="7v7", max_teams=2)
    old_team = Team(league_id=league.id, name="OldTeam", color="#000", created_by="system")
    db.add(old_team)
    db.flush()
    old_id = old_team.id

    _fill_league(db, league, 14)
    _run_team_generation(league, db)

    db.expire_all()
    old_team_fresh = db.query(Team).get(old_id)
    assert old_team_fresh.is_active is False


def test_run_empty_players(db):
    league = make_league(db, format="7v7", max_teams=2)
    result = _run_team_generation(league, db)
    assert result["teams_created"] == 0
    assert result["players_assigned"] == 0


def test_run_teams_count_override(db):
    league = make_league(db, format="7v7", max_teams=2)
    _fill_league(db, league, 14)
    result = _run_team_generation(league, db, teams_count=7)
    assert result["teams_created"] == 7


def test_run_imbalanced_flag_present(db):
    """Team generation returns imbalanced flag and team_sizes in result."""
    league = make_league(db, format="7v7", max_teams=2)
    # 11 players / 3 teams → 3, 4, 4 (diff=1 → balanced)
    _fill_league(db, league, 11)
    result = _run_team_generation(league, db, teams_count=3)
    assert "imbalanced" in result
    assert "team_sizes" in result
    assert len(result["team_sizes"]) == 3
    # Evenly distributed: diff ≤ 1
    assert result["imbalanced"] is False


def test_run_balanced_detection(db):
    league = make_league(db, format="7v7", max_teams=2)
    _fill_league(db, league, 14)
    result = _run_team_generation(league, db, teams_count=2)
    assert result["imbalanced"] is False
