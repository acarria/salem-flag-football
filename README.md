# 🏈 Salem Flag Football League Platform

This is a monorepo for the Flag Football League Management Platform.

## Structure

- `frontend/` – React + TypeScript + Tailwind CSS
- `backend/` – FastAPI (Python)

## Getting Started (with Docker Compose)

1. **Build and start all services:**

   ```sh
   docker-compose up --build
   ```

2. **Frontend:**
   - Runs on [http://localhost:3000](http://localhost:3000)

3. **Backend:**
   - Runs on [http://localhost:8000](http://localhost:8000)
   - Health check: [http://localhost:8000/health](http://localhost:8000/health)

---

## Local Development (without Docker)

- **Frontend:**
  ```sh
  cd frontend
  npm start
  ```
- **Backend:**
  ```sh
  cd backend
  source venv/bin/activate
  uvicorn main:app --reload
  ```
