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

## High-Level Architecture

1. User authenticates in the React frontend.
2. Frontend sends JWT-authenticated requests to the Node backend.
3. User uploads a Postman collection JSON (`POST /scan` or `POST /scans`).
4. Backend validates and parses the collection into normalized requests.
5. Backend creates a scan record (`pending` -> `running`) and sends the job to the Python scanner.
6. Scanner runs baseline + mutation tests, analyzes responses, and returns findings.
7. Backend enriches findings (Gemini if enabled, heuristic fallback otherwise), stores results, and sets scan to `completed` (or `failed` on error).
8. Frontend dashboard and scan details pages query scans/results and render status, metrics, and findings.

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

## Environment Files' Templates:

- `backend/.env.example`
- `scanner/.env.example`
- `frontend/.env.example`

## Database Setup

Use PostgreSQL and run scripts in order:

1. Run `db/01_init.sql` as a PostgreSQL superuser.
2. Connect to `api_security_platform` database.
3. Run `db/02_schema.sql`.

Optional reset:

- Run `db/03_reset.sql`.

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

## SQL Query Layer

The backend query layer is modular and uses parameterized SQL.

- SQL map: `backend/src/db/sqlQueries.js`
- Repositories:
  - `backend/src/db/repositories/usersRepo.js`
  - `backend/src/db/repositories/scansRepo.js`
  - `backend/src/db/repositories/resultsRepo.js`

Raw SQL reference file:

- `backend/src/db/raw-queries.sql`

## Scan Engine Details

Scanner mutations and analysis include:

- Auth mutation tests (header removal, invalid token, token reuse, ID shift replay)
- Parameter/body fuzzing (null, empty, large payloads, wrong types)
- Query and URL mutation checks
- Injection payload tests (SQL, NoSQL, command, XSS)
- Header-based mutation checks (CORS/security-header scenarios)
- Rate-limit burst phase analysis
- Response anomaly analysis (status shifts, size/timing anomalies, reflected payload signals)

## Data Model Summary

Core tables:

- `users`
- `scans` (`pending`, `running`, `completed`, `failed`)
- `results` (`critical`, `high`, `medium`, `low`)

Indexes are created for common query paths (user, scan, status, severity).

## Security Notes

- JWT required for protected endpoints.
- Upload limits enforced on file size and endpoint count.
- Concurrent scan caps enforced.
- Scanner includes SSRF checks for localhost/private networks and DNS resolution safety.

## Notes for Local Development

- Backend auto-initializes tables at startup (`initTables`) and logs ownership/permission issues when DB grants are insufficient.
- Frontend automatically redirects to `/login` on `401` responses.
- Scanner returns structured findings to backend; backend persists and exposes aggregate severity statistics for the UI.