import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Flag Football League API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flagfootball")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CLERK_JWKS_URL: str = os.getenv("CLERK_JWKS_URL", "https://literate-finch-21.clerk.accounts.dev/.well-known/jwks.json")
    CLERK_ISSUER: str = os.getenv("CLERK_ISSUER", "https://literate-finch-21.clerk.accounts.dev/")
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "sk_test_cMFMmIn2Jg880J7wkc2Zof49puvcAjhtYSLLLeHl8B")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "onboarding@resend.dev")

settings = Settings() 