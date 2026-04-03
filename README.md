# API Security Testing Platform

Production-ready API security testing platform with:

- Node.js backend API (JWT auth, upload, scan orchestration)
- Python FastAPI scanner engine (mutation + analysis)
- PostgreSQL data store (users, scans, results)
- React frontend dashboard (auth, scans, upload, details)

## Current Stack

- Backend: Node.js + Express + pg + multer + axios
- Scanner: Python + FastAPI + httpx
- Database: PostgreSQL
- Frontend: React + Vite + Axios + React Router

Prisma/ORM is intentionally removed. The backend uses regular parameterized SQL queries and repository modules.

## Folder Structure

```text
api-security-platform/
|- README.md
|- .gitignore
|- backend/
|  |- .env
|  |- .env.example
|  |- package.json
|  `- src/
|- scanner/
|  |- .env
|  |- .env.example
|  |- requirements.txt
|  `- app/
|- frontend/
|  |- .env
|  |- .env.example
|  |- package.json
|  `- src/
`- db/
   |- 01_init.sql
   |- 02_schema.sql
   `- 03_reset.sql
```

## Environment Files

Already provided:

- `backend/.env`
- `scanner/.env`
- `frontend/.env`

Templates:

- `backend/.env.example`
- `scanner/.env.example`
- `frontend/.env.example`

## Database Setup

Use PostgreSQL and run scripts in order.

### Option A: Run script files

1. Run `db/01_init.sql` as a PostgreSQL superuser.
2. Connect to `api_security_platform` database.
3. Run `db/02_schema.sql`.

Optional reset:

- Run `db/03_reset.sql`.

### Option B: Manual commands

```sql
CREATE DATABASE api_security_platform;
CREATE USER api_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE api_security_platform TO api_user;
```

## Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Scanner

```bash
cd scanner
python -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Run Full Project

Run services in separate terminals.

### Terminal 1: Backend API

```bash
cd backend
npm start
```

Runs on `http://localhost:3000`.

### Terminal 2: Scanner Engine

```bash
cd scanner
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

Runs on `http://localhost:8000`.

### Terminal 3: Frontend Dashboard

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5173`.

## API Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`

### Scans

- `POST /scan` (upload collection)
- `POST /scans` (alias)
- `GET /scans`
- `GET /scans/:scanId`

### Results

- `GET /results?scanId=<id>`
- `GET /results/:resultId`

### Health

- `GET /health`

## Frontend Pages

- `/login`
- `/register`
- `/dashboard`
- `/scan/new`
- `/scans/:scanId`

## SQL Query Layer (No ORM)

The backend query layer is modular and uses parameterized SQL.

- SQL map: `backend/src/db/sqlQueries.js`
- Repositories:
  - `backend/src/db/repositories/usersRepo.js`
  - `backend/src/db/repositories/scansRepo.js`
  - `backend/src/db/repositories/resultsRepo.js`

Raw SQL reference file:

- `backend/src/db/raw-queries.sql`

## Security Notes

- JWT required for protected endpoints.
- Upload limits enforced on file size and endpoint count.
- Concurrent scan caps enforced.
- Scanner includes SSRF checks for localhost/private networks and DNS resolution safety.

## About crAPI Setup

You asked for non-Docker setup for crAPI. For OWASP crAPI specifically, the supported and practical local setup is container-based (Docker Compose) or VM-based deployment from their docs.

Cloning the repo alone is not enough to run crAPI as a single normal process because it is a multi-service application with many dependencies.

For this project itself, Docker is removed as requested.
