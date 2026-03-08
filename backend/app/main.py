import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import user, registration, team, league
from app.api.admin.main import router as admin_router
from app.db.db import SessionLocal
from app.services.admin_service import AdminService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstrap first admin from ADMIN_EMAIL on startup (no separate script)."""
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router, prefix="/user")
app.include_router(registration.router, prefix="/registration")
app.include_router(team.router, prefix="/team")
app.include_router(league.router, prefix="/league")
app.include_router(admin_router)

@app.get("/health")
def health_check():
    return {"status": "ok"} 