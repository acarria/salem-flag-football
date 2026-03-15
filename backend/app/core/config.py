import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    v = os.getenv(name)
    if not v:
        print(f"FATAL: required env var {name!r} is not set", file=sys.stderr)
        sys.exit(1)
    return v


class Settings:
    PROJECT_NAME: str = "Flag Football League API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flagfootball")
    SECRET_KEY: str = _require("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CLERK_JWKS_URL: str = _require("CLERK_JWKS_URL")
    CLERK_ISSUER: str = _require("CLERK_ISSUER")
    CLERK_SECRET_KEY: str = _require("CLERK_SECRET_KEY")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
    RECAPTCHA_SECRET_KEY: str = os.getenv("RECAPTCHA_SECRET_KEY", "")
    CONTACT_EMAIL: str = os.getenv("CONTACT_EMAIL", os.getenv("ADMIN_EMAIL", ""))


settings = Settings()
