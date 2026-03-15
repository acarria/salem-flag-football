import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Required environment variable {name!r} is not set")
    return v


class Settings:
    PROJECT_NAME: str = "Flag Football League API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flagfootball")
    CLERK_JWKS_URL: str = _require("CLERK_JWKS_URL")
    CLERK_ISSUER: str = _require("CLERK_ISSUER")
    CLERK_SECRET_KEY: str = _require("CLERK_SECRET_KEY")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
    RECAPTCHA_SECRET_KEY: str = os.getenv("RECAPTCHA_SECRET_KEY", "")
    CONTACT_EMAIL: str = os.getenv("CONTACT_EMAIL", os.getenv("ADMIN_EMAIL", ""))
    INVITATION_EXPIRY_DAYS: int = int(os.getenv("INVITATION_EXPIRY_DAYS", "7"))
    TEAM_GENERATION_MIN_TEAMS: int = int(os.getenv("TEAM_GENERATION_MIN_TEAMS", "4"))
    TEAM_GENERATION_DIVISOR: int = int(os.getenv("TEAM_GENERATION_DIVISOR", "8"))
    TEAM_NAMES: list[str] = os.getenv(
        "TEAM_NAMES",
        "Red Dragons,Blue Lightning,Green Giants,Yellow Thunder,Purple Power,Orange Crush,Black Knights,White Warriors,Silver Wolves,Gold Eagles"
    ).split(",")
    TEAM_COLORS: list[str] = os.getenv(
        "TEAM_COLORS",
        "#FF4444,#4444FF,#44FF44,#FFFF44,#FF44FF,#FF8844,#444444,#FFFFFF,#C0C0C0,#FFD700"
    ).split(",")


settings = Settings()

if not settings.TEAM_NAMES or not settings.TEAM_COLORS:
    raise RuntimeError("TEAM_NAMES and TEAM_COLORS must not be empty")
