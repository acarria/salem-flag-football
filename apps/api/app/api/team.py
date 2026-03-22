from fastapi import APIRouter, Depends
from app.utils.clerk_jwt import get_current_user

router = APIRouter()

@router.get("/teams", summary="Get all teams")
async def get_teams(user=Depends(get_current_user)):
    # TODO: Fetch teams from DB
    return {"teams": []}