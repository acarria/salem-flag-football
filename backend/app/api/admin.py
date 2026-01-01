# This file is kept for backward compatibility
# The admin functionality has been refactored into separate modules
from app.api.admin.main import router

# Re-export the router for backward compatibility
__all__ = ["router"] 