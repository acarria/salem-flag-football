import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool, QueuePool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flagfootball")

# Use NullPool on Lambda (stateless, ephemeral) to avoid exhausting RDS connections.
# Fall back to the default QueuePool for long-running local/Docker processes.
_is_lambda = bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
engine = create_engine(
    DATABASE_URL,
    echo=not _is_lambda,  # suppress SQL noise in Lambda logs
    future=True,
    poolclass=NullPool if _is_lambda else QueuePool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 