from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PublicLeagueResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    start_date: str
    end_date: str | None
    num_weeks: int
    format: str
    tournament_format: str
    game_duration: int
    games_per_week: int
    max_teams: int | None
    min_teams: int
    registration_deadline: str | None
    registration_fee: int | None
    is_active: bool
    registered_players_count: int
    registered_teams_count: int
    is_registration_open: bool
    player_cap: Optional[int] = None
    spots_remaining: Optional[int] = None
    is_registered: bool | None = None

    model_config = ConfigDict(from_attributes=True)


# Standings schemas

class TeamStandingEntry(BaseModel):
    rank: int
    team_id: UUID
    team_name: str
    wins: int
    losses: int
    points_for: int
    points_against: int
    win_percentage: float


# Schedule schemas

class GameScheduleEntry(BaseModel):
    game_id: UUID
    team1_id: UUID
    team1_name: str
    team2_id: UUID
    team2_name: str
    date: date
    time: str
    status: str
    phase: Optional[str] = None
    team1_score: Optional[int] = None
    team2_score: Optional[int] = None
    winner_id: Optional[UUID] = None


class LeagueScheduleResponse(BaseModel):
    league_id: UUID
    league_name: str
    total_games: int
    schedule_by_week: dict[int, list[GameScheduleEntry]]

