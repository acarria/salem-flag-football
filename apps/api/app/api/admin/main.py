from fastapi import APIRouter, Depends
from app.api.admin.dependencies import get_admin_user
from app.api.admin import league_management, team_management, schedule_management, field_management, admin_management

# Create the main admin router
router = APIRouter(tags=["admin"])

# Include all sub-routers
router.include_router(league_management.router, prefix="/admin")
router.include_router(team_management.router, prefix="/admin")
router.include_router(schedule_management.router, prefix="/admin")
router.include_router(field_management.router, prefix="/admin")
router.include_router(admin_management.router, prefix="/admin")

# Add a simple test endpoint
@router.get("/admin/test-auth", summary="Test authentication")
async def test_auth(admin_user=Depends(get_admin_user)):
    """Test endpoint to verify authentication is working"""
    return {"message": "Authentication successful", "is_admin": True}
