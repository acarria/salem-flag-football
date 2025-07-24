from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, user, registration, team, league, admin

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth")
app.include_router(user.router, prefix="/user")
app.include_router(registration.router, prefix="/registration")
app.include_router(team.router, prefix="/team")
app.include_router(league.router, prefix="/league")
app.include_router(admin.router, prefix="/admin")

@app.get("/health")
def health_check():
    return {"status": "ok"} 