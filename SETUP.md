# Setup Guide

## Prerequisites

- **Node.js**: 18+ (https://nodejs.org/)
- **Python**: 3.9+ (https://www.python.org/)
- **PostgreSQL**: 12+ (https://www.postgresql.org/)
- **Git**: (https://git-scm.com/)

## Manual Setup (Without Docker)

### Step 1: Clone/Extract Repository

```bash
cd api-security-platform
```

### Step 2: Database Setup

#### Create PostgreSQL Database

```bash
# Connect to PostgreSQL (adjust user/password if different)
psql -U postgres

# Create database
CREATE DATABASE api_security_platform;
CREATE USER api_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE api_security_platform TO api_user;

# Exit psql
\q
```

#### Verify Connection

```bash
psql -U api_user -d api_security_platform -h localhost
# If successful, you'll see the psql prompt: api_security_platform=#
\q
```

### Step 3: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Edit .env with your database credentials
nano .env
# Or use your preferred editor

# Update these values:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=api_security_platform
# DB_USER=api_user
# DB_PASSWORD=secure_password
# JWT_SECRET=your_custom_secret_key (change this!)
```

#### Initialize Database Tables

Tables are automatically created when the server starts. Verify by running:

```bash
# Start the server (will create tables automatically)
npm start
# You should see: "Database tables initialized successfully"
# Server should be running on port 3000
```

### Step 4: Scanner Setup

```bash
# In a new terminal, from the root directory
cd scanner

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Verify activation (you should see (venv) in your prompt)

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env if needed (defaults are usually fine for local dev)
nano .env
```

#### Start Scanner

```bash
# Make sure you're in the scanner directory with venv activated
python -m uvicorn app.main:app --reload --port 8000
# Server should be running on http://localhost:8000
# Reload mode allows hot-reloading during development
```

### Step 5: Verify Everything is Working

**In a new terminal:**

```bash
# Test backend health
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"2024-..."}

# Test scanner health
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"API Security Scanner","timestamp":"2024-..."}

# Test database connection by registering a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123"}'
# Expected: {"message":"User registered successfully","user":{...}}
```

---

## Docker Setup

### Quick Start with Docker Compose

```bash
# From the root directory
docker-compose up -d

# Wait 10-15 seconds for services to initialize

# Verify services are running
docker ps
# You should see: api-security-db, api-security-backend, api-security-scanner

# Check logs
docker-compose logs -f backend
docker-compose logs -f scanner
```

### Build and Run Individually

```bash
# Build backend
docker build -t api-security-backend ./backend

# Build scanner
docker build -t api-security-scanner ./scanner

# Run PostgreSQL
docker run -d \
  --name api-security-db \
  -e POSTGRES_DB=api_security_platform \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# Wait for database to start, then run backend
docker run -d \
  --name api-security-backend \
  -p 3000:3000 \
  -e DB_HOST=api-security-db \
  -e JWT_SECRET=your_custom_secret \
  --link api-security-db \
  api-security-backend

# Run scanner
docker run -d \
  --name api-security-scanner \
  -p 8000:8000 \
  --link api-security-backend \
  api-security-scanner
```

### View Logs

```bash
# Compose
docker-compose logs -f

# Individual containers
docker logs -f api-security-backend
docker logs -f api-security-scanner
```

### Stop Services

```bash
# Compose
docker-compose down

# Individual containers
docker stop api-security-backend api-security-scanner api-security-db
docker rm api-security-backend api-security-scanner api-security-db
```

---

## Configuration

### Backend Environment Variables

Create or edit `backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=api_security_platform
DB_USER=api_user
DB_PASSWORD=secure_password

# JWT Authentication
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# Python Scanner Service
PYTHON_SCANNER_URL=http://localhost:8000

# File Upload Settings
MAX_FILE_SIZE=10485760  # 10 MB
MAX_FILES=1
UPLOAD_DIR=./uploads

# Security
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
MAX_ENDPOINTS_PER_SCAN=100
MAX_CONCURRENT_SCANS=5
```

### Scanner Environment Variables

Create or edit `scanner/.env`:

```env
PORT=8000
HOST=localhost
ERROR_THRESHOLD=5
TIMEOUT=30
MAX_RETRIES=3
BLOCKED_HOSTS=localhost,127.0.0.1,0.0.0.0
BLOCKED_NETWORKS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
MAX_REQUESTS_PER_ENDPOINT=50
MAX_PAYLOAD_SIZE=1048576
NODE_BACKEND_URL=http://localhost:3000
```

---

## Testing the Installation

### 1. Create Test Account

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }'
```

Expected response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "testuser@example.com",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }' | jq '.token'
```

Save the token output (without quotes):
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }' | jq -r '.token')

echo $TOKEN
```

### 3. Upload Example Collection

```bash
curl -X POST http://localhost:3000/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@docs/example-collection.json"
```

Expected response:
```json
{
  "message": "Scan created and queued for processing",
  "scan": {
    "id": 1,
    "status": "pending",
    "endpoints_count": 10,
    "created_at": "2024-01-15T12:05:00Z"
  }
}
```

### 4. Check Scan Status

```bash
curl -X GET http://localhost:3000/scans/1 \
  -H "Authorization: Bearer $TOKEN"
```

Status will progress: `pending` → `running` → `completed`

### 5. View Results

```bash
# Wait for scan to complete, then view results
curl -X GET "http://localhost:3000/results?scanId=1" \
  -H "Authorization: Bearer $TOKEN"
```

Example response:
```json
{
  "scan_id": 1,
  "results": [
    {
      "id": 1,
      "endpoint": "https://api.example.com/users",
      "method": "GET",
      "vulnerability": "Broken Authentication",
      "severity": "critical",
      "details": {...},
      "evidence": "Auth header removal did not reject request",
      "created_at": "2024-01-15T12:06:30Z"
    }
  ],
  "statistics": {
    "total": 1,
    "by_severity": {
      "critical": 1,
      "high": 0,
      "medium": 0,
      "low": 0
    }
  }
}
```

---

## Troubleshooting

### PostgreSQL Connection Errors

**Error**: `connection refused at 127.0.0.1:5432`

**Solutions**:
1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgres
   
   # Windows
   sc query postgresql-x64-15  # or your version
   
   # Linux
   systemctl status postgresql
   ```

2. Verify credentials in `.env` match your PostgreSQL setup

3. Test connection directly:
   ```bash
   psql -U api_user -d api_security_platform -h localhost
   ```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000` or `:8000`

**Solutions**:
1. Change ports in `.env`
2. Kill existing process:
   ```bash
   # Find what's using port 3000
   lsof -i :3000
   # Kill the process
   kill -9 <PID>
   ```

### Module Not Found

**Error**: `Cannot find module 'express'`

**Solution**: Install dependencies:
```bash
cd backend
npm install
```

### Python Module Not Found

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solutions**:
1. Ensure virtual environment is activated:
   ```bash
   source venv/bin/activate  # macOS/Linux
   venv\Scripts\activate      # Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Scanner Can't Reach Backend

**Error**: `Connection refused` from scanner to backend

**Solutions**:
1. In Docker: Use service name `http://backend:3000`
2. Locally: Ensure both are running and use `http://localhost:3000`
3. Check firewall settings

### Database Tables Not Created

**Solution**: Tables are auto-created on first backend start. If they don't exist:

```bash
# Manually create them by running queries in psql:
psql -U api_user -d api_security_platform -h localhost

# Then paste the schema from src/db/connection.js
```

---

## Development Mode

### Enable Hot Reload

**Backend:**
```bash
cd backend
npm install --save-dev nodemon
npm run dev
```

**Scanner:**
```bash
cd scanner
python -m uvicorn app.main:app --reload --port 8000
```

### Debugging

**Backend:**
```bash
# Add debugger statement in code
debugger;

# Run with inspector
node --inspect src/index.js

# Open chrome://inspect in Chrome
```

**Scanner:**
```bash
# Add breakpoints and run
python -m pdb app/main.py
```

---

## Production Deployment

### Security Checklist

- [ ] Change JWT_SECRET to a random 32+ character string
- [ ] Use HTTPS/TLS certificates
- [ ] Set NODE_ENV=production
- [ ] Use strong database password
- [ ] Enable database backups
- [ ] Set up firewall rules
- [ ] Monitor logs and errors
- [ ] Rate limit all endpoints
- [ ] Use environment variables (never hardcode secrets)
- [ ] Run behind reverse proxy (nginx/Apache)

### Environment Template for Production

**backend/.env.production:**
```env
PORT=3000
NODE_ENV=production
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_NAME=api_security_platform
DB_USER=app_user
DB_PASSWORD=<random_secure_password>
JWT_SECRET=<random_32+_char_string>
JWT_EXPIRES_IN=24h
PYTHON_SCANNER_URL=https://scanner.example.com
MAX_FILE_SIZE=10485760
MAX_ENDPOINTS_PER_SCAN=100
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Next Steps

1. Read [API.md](./docs/API.md) for detailed endpoint documentation
2. Review [README.md](./README.md) for architecture overview
3. Check [example-collection.json](./docs/example-collection.json) for sample Postman format
4. Start testing with your own API collections

