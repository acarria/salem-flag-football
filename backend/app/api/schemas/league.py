from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

# Public league response schema (moved from app/api/league.py)
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

    class Config:
        from_attributes = True

