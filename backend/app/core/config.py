import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Flag Football League API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flagfootball")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CLERK_JWKS_URL: str = os.getenv("CLERK_JWKS_URL", "https://REDACTED_CLERK_INSTANCE.clerk.accounts.dev/.well-known/jwks.json")
    CLERK_ISSUER: str = os.getenv("CLERK_ISSUER", "https://REDACTED_CLERK_INSTANCE.clerk.accounts.dev/")
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "REDACTED_CLERK_SECRET_KEY")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "onboarding@resend.dev")

settings = Settings() 