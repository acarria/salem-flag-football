from fastapi import APIRouter, Depends
from app.utils.clerk_jwt import get_current_user

router = APIRouter()

@router.post("/solo", summary="Solo registration")
async def solo_registration(data: dict, user=Depends(get_current_user)):
    # TODO: Store solo registration info in DB
    return {"message": "Solo registration submitted", "user": user}

@router.post("/group", summary="Group registration")
async def group_registration(data: dict, user=Depends(get_current_user)):
    # TODO: Store group registration info in DB
    return {"message": "Group registration submitted", "user": user} 