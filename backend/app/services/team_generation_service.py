"""
Team Generation Service

Extracts core team assignment logic so it can be triggered both manually
(admin "Generate Teams" button) and automatically when registration is complete.
"""
import logging
from typing import Optional, Dict, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.config import settings

logger = logging.getLogger(__name__)


def _run_team_generation(league, db: Session, teams_count: Optional[int] = None) -> dict:
    """
    Core team generation logic. Creates teams and assigns confirmed players.
    Returns a summary dict.
    """
    from app.models.league_player import LeaguePlayer
    from app.models.player import Player
    from app.models.team import Team

    registered_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True,
    ).all()

    if not registered_players:
        return {"teams_created": 0, "players_assigned": 0, "groups_kept_together": 0, "groups_split": 0, "team_details": []}

    total_players = len(registered_players)

    if teams_count is None:
        teams_count = max(settings.TEAM_GENERATION_MIN_TEAMS, total_players // settings.TEAM_GENERATION_DIVISOR)

    players_per_team = total_players // teams_count

    team_names = settings.TEAM_NAMES
    team_colors = settings.TEAM_COLORS

    # Clear existing teams
    existing_teams = db.query(Team).filter(Team.league_id == league.id).all()
    for team in existing_teams:
        team.is_active = False

    # Create new teams
    teams = []
    for i in range(teams_count):
        team = Team(
            league_id=league.id,
            name=team_names[i % len(team_names)],
            color=team_colors[i % len(team_colors)],
            created_by="system",
        )
        db.add(team)
        db.flush()
        teams.append(team)

    # Group players by group_id
    players_by_group: Dict[UUID, List] = {}
    ungrouped_players = []
    for lp in registered_players:
        if lp.group_id:
            players_by_group.setdefault(lp.group_id, []).append(lp)
        else:
            ungrouped_players.append(lp)

    groups_kept_together = 0
    groups_split = 0
    players_assigned = 0
    team_assignments: Dict[UUID, List] = {team.id: [] for team in teams}

    for group_id, group_players in players_by_group.items():
        if len(group_players) <= players_per_team:
            best_team = None
            min_count = float('inf')
            for team in teams:
                current = len(team_assignments[team.id])
                if current + len(group_players) <= players_per_team and current < min_count:
                    min_count = current
                    best_team = team
            if best_team:
                for lp in group_players:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
                groups_kept_together += 1
            else:
                for lp in group_players:
                    best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                    if len(team_assignments[best_team.id]) < players_per_team:
                        lp.team_id = best_team.id
                        team_assignments[best_team.id].append(lp)
                        players_assigned += 1
                    else:
                        logger.warning("Team generation overflow: assigning player %s to over-full team %s", lp.player_id, best_team.id)
                        lp.team_id = best_team.id
                        team_assignments[best_team.id].append(lp)
                        players_assigned += 1
                groups_split += 1
        else:
            for lp in group_players:
                best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                if len(team_assignments[best_team.id]) < players_per_team:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
                else:
                    logger.warning("Team generation overflow: assigning player %s to over-full team %s", lp.player_id, best_team.id)
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
            groups_split += 1

    for lp in ungrouped_players:
        best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
        if len(team_assignments[best_team.id]) < players_per_team:
            lp.team_id = best_team.id
            team_assignments[best_team.id].append(lp)
            players_assigned += 1
        else:
            logger.warning("Team generation overflow: assigning player %s to over-full team %s", lp.player_id, best_team.id)
            lp.team_id = best_team.id
            team_assignments[best_team.id].append(lp)
            players_assigned += 1

    db.commit()

    team_details = []
    for team in teams:
        team_players = team_assignments[team.id]
        team_details.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "team_color": team.color,
            "player_count": len(team_players),
            "players": [
                {
                    "player_id": str(lp.player_id),
                    "group_id": str(lp.group_id) if lp.group_id else None,
                }
                for lp in team_players
            ],
        })

    return {
        "teams_created": teams_count,
        "players_assigned": players_assigned,
        "groups_kept_together": groups_kept_together,
        "groups_split": groups_split,
        "team_details": team_details,
    }


def trigger_team_generation_if_ready(league_id: UUID, db: Session) -> bool:
    """
    Called after each registration event.
    If registration is closed (deadline passed or league full), trigger team generation.
    Returns True if generation was triggered.
    """
    from app.models.league import League
    from app.models.league_player import LeaguePlayer
    from app.models.team import Team
    from app.services.league_service import get_player_cap, get_occupied_spots
    from datetime import date

    league = db.query(League).filter(League.id == league_id, League.is_active == True).first()
    if not league:
        return False

    # Don't re-generate if teams already exist
    existing_teams = db.query(Team).filter(
        Team.league_id == league_id,
        Team.is_active == True,
    ).count()
    if existing_teams > 0:
        return False

    # Check if registration is now full
    player_cap = get_player_cap(league.format, league.max_teams)
    if player_cap is None:
        return False  # Uncapped — don't auto-generate

    occupied = get_occupied_spots(league_id, db)
    deadline_passed = (
        league.registration_deadline is not None
        and league.registration_deadline < date.today()
    )
    is_full = occupied >= player_cap

    if is_full or deadline_passed:
        _run_team_generation(league, db)
        return True

    return False
