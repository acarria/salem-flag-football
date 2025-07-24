from fastapi import APIRouter, Depends
from app.utils.clerk_jwt import get_current_user

router = APIRouter()

@router.get("/teams", summary="Get all teams")
async def get_teams(user=Depends(get_current_user)):
    # TODO: Fetch teams from DB
    return {"teams": []}

@router.post("/teams", summary="Create a team")
async def create_team(data: dict, user=Depends(get_current_user)):
    # TODO: Create team in DB
    return {"message": "Team created"}

@router.post("/invite", summary="Invite user to group/team")
async def invite_user(data: dict, user=Depends(get_current_user)):
    # TODO: Send invitation and store in DB
    return {"message": "Invitation sent"} 