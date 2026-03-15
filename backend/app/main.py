import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.api import user, registration, team, league, contact
from app.api.admin.main import router as admin_router
from app.db.db import SessionLocal
from app.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstrap first admin from ADMIN_EMAIL on startup (no separate script)."""
    # Log Clerk config so issuer mismatches surface immediately in server logs
    from app.core.config import settings
    logger.info("Clerk config — JWKS_URL=%s  ISSUER=%s", settings.CLERK_JWKS_URL, settings.CLERK_ISSUER)

    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        db = SessionLocal()
        try:
            if not AdminService.is_admin_email(db, admin_email):
                AdminService.add_admin_email(db, admin_email.strip().lower(), "super_admin")
        except Exception:
            db.rollback()
        finally:
            db.close()

    yield


app = FastAPI(lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(user.router, prefix="/user")
app.include_router(registration.router, prefix="/registration")
app.include_router(team.router, prefix="/team")
app.include_router(league.router, prefix="/league")
app.include_router(admin_router)
app.include_router(contact.router, prefix="/contact")

@app.get("/health")
def health_check():
    return {"status": "ok"}


# Lambda handler (used when deployed to AWS Lambda via Mangum)
from mangum import Mangum  # noqa: E402
handler = Mangum(app, lifespan="off") 