import os
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.api import user, registration, team, league, contact, waiver
from app.api.admin.main import router as admin_router
from app.db.db import SessionLocal, Base, engine, get_db
from app.services.admin_service import AdminService

# Import all models so Base.metadata is fully populated before create_all
import app.models.admin_config  # noqa: F401
import app.models.field  # noqa: F401
import app.models.field_availability  # noqa: F401
import app.models.game  # noqa: F401
import app.models.group  # noqa: F401
import app.models.group_invitation  # noqa: F401
import app.models.league  # noqa: F401
import app.models.league_field  # noqa: F401
import app.models.league_player  # noqa: F401
import app.models.player  # noqa: F401
import app.models.team  # noqa: F401
import app.models.user  # noqa: F401
import app.models.waiver  # noqa: F401

import json as _json

class _CorrelationFilter(logging.Filter):
    """Inject the current correlation ID into every log record."""
    def filter(self, record):
        from app.core.middleware import correlation_id_var
        record.correlation_id = correlation_id_var.get("")
        return True


class _JSONFormatter(logging.Formatter):
    """Structured JSON formatter for CloudWatch Insights."""
    def format(self, record):
        entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if getattr(record, "correlation_id", None):
            entry["correlation_id"] = record.correlation_id
        if getattr(record, "event", None):
            entry["event"] = record.event
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return _json.dumps(entry)

_log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)

_handler = logging.StreamHandler()
_handler.setFormatter(_JSONFormatter())
_handler.addFilter(_CorrelationFilter())
logging.root.addHandler(_handler)
logging.root.setLevel(_log_level)

logger = logging.getLogger(__name__)

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstrap DB and first admin on startup."""
    # Log Clerk config so issuer mismatches surface immediately in server logs
    from app.core.config import settings
    logger.info("Clerk config — JWKS_URL=%s  ISSUER=%s", settings.CLERK_JWKS_URL, settings.CLERK_ISSUER)

    # In local dev (non-Lambda), create all tables directly from models.
    # On Lambda, tables are managed by Alembic migrations run before deploy.
    if not os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        Base.metadata.create_all(bind=engine)
        logger.info("DB tables ensured via create_all (local dev)")

    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        db = SessionLocal()
        try:
            if not AdminService.is_admin_email(db, admin_email):
                AdminService.add_admin_email(db, admin_email.strip().lower(), "super_admin")
                db.commit()
        except Exception:
            logger.exception("Failed to seed initial admin from ADMIN_EMAIL")
            db.rollback()
        finally:
            db.close()

    yield


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # HSTS: safe to set unconditionally — browsers only honor it over HTTPS
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        # This is a pure JSON API; restrict resource loading aggressively
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        return response


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

app.add_middleware(SecurityHeadersMiddleware)

from app.core.middleware import CorrelationIDMiddleware
app.add_middleware(CorrelationIDMiddleware)

app.include_router(user.router, prefix="/user")
app.include_router(registration.router, prefix="/registration")
app.include_router(team.router, prefix="/team")
app.include_router(league.router, prefix="/league")
app.include_router(admin_router)
app.include_router(contact.router, prefix="/contact")
app.include_router(waiver.router, prefix="/waiver")

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


# Lambda handler (used when deployed to AWS Lambda via Mangum)
from mangum import Mangum  # noqa: E402
handler = Mangum(app, lifespan="off") 