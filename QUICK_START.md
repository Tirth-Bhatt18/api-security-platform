# Quick Start Guide

Get the API Security Testing Platform running in 5 minutes.

## Option 1: Docker Compose (Easiest)

### Requirements
- Docker
- Docker Compose

### Steps

```bash
# Clone/extract repository
cd api-security-platform

# Start services
docker-compose up -d

# Wait 15 seconds, verify services running
docker ps

# You should see 3 containers:
# - api-security-db
# - api-security-backend  
# - api-security-scanner
```

### Quick Test

```bash
# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test123456"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test123456"}' \
  | jq -r '.token')

# Upload example collection and start scan
curl -X POST http://localhost:3000/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@docs/example-collection.json"

# The response will give you a scan_id (typically 1 for first scan)
# Wait ~30 seconds for scan to complete

# Check results
curl -X GET "http://localhost:3000/results?scanId=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Option 2: Manual Setup (Local)

### Requirements
- Node.js 18+
- Python 3.9+
- PostgreSQL 12+

### Step 1: Database

```bash
# Create database
createdb api_security_platform

# Verify
psql -d api_security_platform -c "SELECT version();"
```

### Step 2: Backend

```bash
cd backend

# Install & configure
npm install
cp .env.example .env

# Edit .env: Set DB_PASSWORD to match your PostgreSQL setup

# Start server
npm start
# Shows: "Database tables initialized successfully"
# Shows: "API Security Platform Backend running on port 3000"
```

### Step 3: Scanner (New Terminal)

```bash
cd scanner

# Setup Python environment
python -m venv venv
source venv/bin/activate  # Or: venv\Scripts\activate (Windows)

# Install & run
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
# Shows: "Uvicorn running on http://0.0.0.0:8000"
```

### Step 4: Test (New Terminal)

Follow "Quick Test" section above (same curl commands).

---

## Architecture

```
User Client
    ↓
[Node.js API Backend] ←→ [PostgreSQL Database]
    ↓
[Python Security Scanner]
    ↓
[Target APIs]
```

- **Backend**: Handles authentication, file uploads, and results storage
- **Scanner**: Tests APIs for vulnerabilities
- **Database**: Stores users, scans, and findings

---

## Supported Vulnerability Types

| Type | Severity | Detection Method |
|------|----------|-----------------|
| SQL Injection | Critical | Database error patterns |
| Command Injection | Critical | Command output detection |
| Broken Authentication | Critical | Auth bypass testing |
| NoSQL Injection | High | Query operator injection |
| XSS | High | Script reflection detection |
| XXE | High | Entity injection patterns |
| IDOR/BOLA | High | Response size/timing anomalies |
| CORS Misconfiguration | Medium | Origin header testing |
| Improper Input Validation | Medium | Parameter fuzzing |
| Timing Anomalies | Low | Response time analysis |

---

## API Examples

### 1. Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePass123!"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePass123!"
  }'

# Save token from response
# export TOKEN="eyJhbGciOi..."
```

### 3. Upload Collection

```bash
curl -X POST http://localhost:3000/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-api-collection.json"
```

**Response:**
```json
{
  "message": "Scan created and queued for processing",
  "scan": {
    "id": 1,
    "status": "pending",
    "endpoints_count": 10,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### 4. Check Status

```bash
curl http://localhost:3000/scans/1 \
  -H "Authorization: Bearer $TOKEN"
```

Status flow: `pending` → `running` → `completed`

### 5. View Results

```bash
curl "http://localhost:3000/results?scanId=1" \
  -H "Authorization: Bearer $TOKEN"
```

Example finding:
```json
{
  "endpoint": "https://api.example.com/users/123",
  "method": "GET",
  "vulnerability": "SQL Injection",
  "severity": "critical",
  "evidence": "Database error exposed: SQL syntax..."
}
```

---

## Collection Format

Your Postman collection should follow v2.1 format:

```json
{
  "info": {
    "name": "My API",
    "version": "1.0.0"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://api.example.com"
    }
  ],
  "item": [
    {
      "name": "Get Users",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/users",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer token123"
          }
        ]
      }
    }
  ]
}
```

See `docs/example-collection.json` for a complete example.

---

## Useful Commands

### Docker

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f scanner
docker-compose logs -f postgres

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# Remove volumes (reset database)
docker-compose down -v
```

### Manual

```bash
# Test backend
curl http://localhost:3000/health

# Test scanner
curl http://localhost:8000/health

# Check PostgreSQL
psql -d api_security_platform -c "SELECT * FROM users;"

# Monitor logs
tail -f backend.log
tail -f scanner.log
```

---

## Troubleshooting

### Port 3000/8000 already in use

```bash
# Change in .env or docker-compose.yml
# Or kill existing process:
lsof -i :3000
kill -9 <PID>
```

### Database won't connect

```bash
# Verify PostgreSQL is running
psql --version

# Check .env credentials
cat backend/.env | grep DB_

# Test direct connection
psql -U postgres -d api_security_platform
```

### Scanner not responding

```bash
# Verify it's running
curl http://localhost:8000/health

# Check environment
source venv/bin/activate
python -c "import fastapi; print('OK')"
```

### Invalid JSON in Postman collection

```bash
# Validate JSON
python -m json.tool collection.json > /dev/null

# Or use jq
jq . collection.json > /dev/null
```

---

## Configuration

### Environment Variables

**Backend** (backend/.env):
```env
PORT=3000
DB_HOST=localhost
DB_NAME=api_security_platform
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=change_this_secret
PYTHON_SCANNER_URL=http://localhost:8000
MAX_ENDPOINTS_PER_SCAN=100
```

**Scanner** (scanner/.env):
```env
PORT=8000
TIMEOUT=30
MAX_RETRIES=3
BLOCKED_HOSTS=localhost,127.0.0.1,0.0.0.0
NODE_BACKEND_URL=http://localhost:3000
```

---

## Files Overview

```
api-security-platform/
├── README.md                      # Full documentation
├── SETUP.md                       # Installation guide
├── ARCHITECTURE.md                # System design
├── QUICK_START.md                 # This file
├── docker-compose.yml             # Docker setup
│
├── backend/                       # Node.js Express
│   ├── package.json               # Dependencies
│   ├── .env.example               # Environment template
│   ├── Dockerfile                 # Docker image
│   └── src/
│       ├── index.js               # Main server
│       ├── routes/                # API endpoints
│       ├── middleware/            # Auth, errors
│       ├── services/              # Business logic
│       └── db/                    # Database
│
├── scanner/                       # Python FastAPI
│   ├── requirements.txt           # Dependencies
│   ├── .env.example               # Environment template
│   ├── Dockerfile                 # Docker image
│   └── app/
│       ├── main.py                # FastAPI server
│       └── engines/               # Scanning logic
│
└── docs/
    ├── API.md                     # Endpoint docs
    └── example-collection.json    # Sample Postman
```

---

## Next Steps

1. **Read documentation**: See [README.md](./README.md) for full details
2. **Understand architecture**: Check [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Detailed setup**: Follow [SETUP.md](./SETUP.md)
4. **API reference**: See [docs/API.md](./docs/API.md)
5. **Test with real APIs**: Use `docs/example-collection.json` as template
6. **Monitor scans**: Use endpoint status checks to track progress
7. **Review findings**: Analyze vulnerability reports and fix issues

---

## Key Features

✅ **Automated Security Testing**
- Upload Postman collections
- Automatic mutation testing
- Multiple vulnerability detection

✅ **Production-Ready**
- JWT authentication
- PostgreSQL database
- Async processing
- Docker support

✅ **Comprehensive Detection**
- 10+ vulnerability types
- Multiple testing strategies
- Detailed evidence reporting

✅ **Easy Integration**
- Simple REST API
- Standard JSON formats
- Clear error messages

---

## Support

**For help:**
1. Check logs: `docker-compose logs`
2. Read docs: [SETUP.md](./SETUP.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Verify services: Use `/health` endpoints
4. Test manually: Use curl commands from this guide

**Common issues:**
- Database not connecting → Check .env credentials
- Port in use → Kill existing process or change port
- Module not found → Run `npm install` or `pip install -r requirements.txt`
- Postman invalid → Validate JSON with `python -m json.tool`

