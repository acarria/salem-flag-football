from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.league_player import LeaguePlayer
from app.models.group import Group
from app.api.schemas.admin import (
    LeagueMemberResponse, TeamResponse, TeamGenerationRequest, TeamGenerationResponse
)
from app.api.admin.dependencies import get_admin_user

router = APIRouter()

@router.get("/leagues/{league_id}/members", response_model=List[LeagueMemberResponse], summary="Get all league members")
async def get_league_members(
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all registered members for a specific league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all league players with their details
    league_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.is_active == True
    ).all()
    
    result = []
    for lp in league_players:
        player = db.query(Player).filter(Player.id == lp.player_id).first()
        if not player:
            continue
            
        # Get group info
        group_name = None
        if lp.group_id:
            group = db.query(Group).filter(Group.id == lp.group_id).first()
            group_name = group.name if group else None
        
        # Get team info
        team_name = None
        if lp.team_id:
            team = db.query(Team).filter(Team.id == lp.team_id).first()
            team_name = team.name if team else None
        
        result.append(LeagueMemberResponse(
            id=lp.id,
            player_id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            email=player.email,
            group_id=lp.group_id,
            group_name=group_name,
            team_id=lp.team_id,
            team_name=team_name,
            registration_status=lp.registration_status,
            payment_status=lp.payment_status,
            waiver_status=lp.waiver_status,
            created_at=lp.created_at
        ))
    
    return result

@router.get("/leagues/{league_id}/teams", response_model=List[TeamResponse], summary="Get all teams for a league")
async def get_league_teams(
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all teams for a specific league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all teams for this league
    teams = db.query(Team).filter(
        Team.league_id == league_id,
        Team.is_active == True
    ).order_by(Team.name).all()
    
    return [TeamResponse.model_validate(team) for team in teams]

@router.post("/leagues/{league_id}/generate-teams", response_model=TeamGenerationResponse, summary="Generate teams for league")
async def generate_teams(
    league_id: UUID,
    team_data: TeamGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Generate teams for a league, respecting group registrations when possible"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all confirmed players for this league
    registered_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True
    ).all()

    if not registered_players:
        raise HTTPException(status_code=400, detail="No confirmed players found for this league")
    
    # Group players by their group_id
    players_by_group = {}
    ungrouped_players = []
    
    for lp in registered_players:
        if lp.group_id:
            if lp.group_id not in players_by_group:
                players_by_group[lp.group_id] = []
            players_by_group[lp.group_id].append(lp)
        else:
            ungrouped_players.append(lp)
    
    # Calculate optimal number of teams
    total_players = len(registered_players)
    if team_data.teams_count:
        teams_count = team_data.teams_count
    else:
        # Default to 4 teams minimum, or calculate based on players
        teams_count = max(4, total_players // 8)  # Assume ~8 players per team
    
    # Calculate players per team
    players_per_team = total_players // teams_count
    if team_data.max_players_per_team:
        players_per_team = min(players_per_team, team_data.max_players_per_team)
    if team_data.min_players_per_team:
        players_per_team = max(players_per_team, team_data.min_players_per_team)
    
    # Generate team names and colors
    team_names = team_data.team_names or [
        "Red Dragons", "Blue Lightning", "Green Giants", "Yellow Thunder",
        "Purple Power", "Orange Crush", "Black Knights", "White Warriors"
    ]
    team_colors = team_data.team_colors or [
        "#FF4444", "#4444FF", "#44FF44", "#FFFF44",
        "#FF44FF", "#FF8844", "#444444", "#FFFFFF"
    ]
    
    # Clear existing teams for this league
    existing_teams = db.query(Team).filter(Team.league_id == league_id).all()
    for team in existing_teams:
        team.is_active = False
    
    # Create new teams
    teams = []
    for i in range(teams_count):
        team = Team(
            league_id=league_id,
            name=team_names[i % len(team_names)],
            color=team_colors[i % len(team_colors)],
            created_by=admin_user["id"]
        )
        db.add(team)
        db.flush()  # Get the team ID
        teams.append(team)
    
    # Assign players to teams, trying to keep groups together
    groups_kept_together = 0
    groups_split = 0
    players_assigned = 0
    
    # First, try to assign complete groups to teams
    team_assignments = {team.id: [] for team in teams}
    
    for group_id, group_players in players_by_group.items():
        if len(group_players) <= players_per_team:
            # Find a team with enough space for the entire group
            best_team = None
            min_players = float('inf')
            
            for team in teams:
                current_players = len(team_assignments[team.id])
                if current_players + len(group_players) <= players_per_team:
                    if current_players < min_players:
                        min_players = current_players
                        best_team = team
            
            if best_team:
                # Assign entire group to this team
                for lp in group_players:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
                groups_kept_together += 1
            else:
                # Have to split the group
                for lp in group_players:
                    # Find team with most space
                    best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                    if len(team_assignments[best_team.id]) < players_per_team:
                        lp.team_id = best_team.id
                        team_assignments[best_team.id].append(lp)
                        players_assigned += 1
                groups_split += 1
        else:
            # Group is too large, must split
            for lp in group_players:
                best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                if len(team_assignments[best_team.id]) < players_per_team:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
            groups_split += 1
    
    # Assign ungrouped players
    for lp in ungrouped_players:
        best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
        if len(team_assignments[best_team.id]) < players_per_team:
            lp.team_id = best_team.id
            team_assignments[best_team.id].append(lp)
            players_assigned += 1
    
    # Commit all changes
    db.commit()

    # Pre-fetch all assigned players in a single query to avoid N+1
    all_assigned_ids = [lp.player_id for team_lps in team_assignments.values() for lp in team_lps]
    players_map = {
        p.id: p for p in db.query(Player).filter(Player.id.in_(all_assigned_ids)).all()
    }

    # Prepare response details
    team_details = []
    for team in teams:
        team_players = team_assignments[team.id]
        team_details.append({
            "team_id": team.id,
            "team_name": team.name,
            "team_color": team.color,
            "player_count": len(team_players),
            "players": [
                {
                    "player_id": lp.player_id,
                    "first_name": players_map[lp.player_id].first_name,
                    "last_name": players_map[lp.player_id].last_name,
                    "group_id": lp.group_id
                }
                for lp in team_players
                if lp.player_id in players_map
            ]
        })
    
    return TeamGenerationResponse(
        teams_created=teams_count,
        players_assigned=players_assigned,
        groups_kept_together=groups_kept_together,
        groups_split=groups_split,
        team_details=team_details
    )

