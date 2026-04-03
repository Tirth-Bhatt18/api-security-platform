# API Security Testing Platform

A comprehensive backend system for automated API security vulnerability scanning. Upload Postman collections, and the platform automatically tests for common security vulnerabilities.

## Architecture Overview

```
┌─────────────────┐
│   User Client   │
└────────┬────────┘
         │
    HTTP │ (REST API)
         │ JWT Auth
         ▼
┌──────────────────────────┐     
│  Node.js Express Backend │     
│  - Auth (JWT + Bcrypt)   │     
│  - File Upload (Multer)  │     
│  - Postman Parser        │     
│  - PostgreSQL DB         │     
└────────┬─────────────────┘     
         │
    HTTP │ (JSON)
         │
         ▼
┌──────────────────────────┐
│  Python FastAPI Scanner  │
│  - Request Execution     │
│  - Mutation Engine       │
│  - Response Analysis     │
│  - Vulnerability Report  │
└──────────────────────────┘
```

## Features

### Backend (Node.js/Express)
- ✅ JWT-based authentication with password hashing (bcrypt)
- ✅ Postman collection upload and parsing (v2.1 format)
- ✅ SQLi, NoSQLi, command injection detection
- ✅ Authentication & authorization testing
- ✅ CORS and security header validation
- ✅ Rate limiting and SSRF protection
- ✅ PostgreSQL integration with parameterized queries
- ✅ Async scan job processing

### Scanner (Python/FastAPI)
- ✅ HTTP request executor with timeout/retry logic
- ✅ Parameter mutation (null, empty, large values, type errors)
- ✅ Injection payload testing
- ✅ Authentication bypass detection
- ✅ Response fingerprinting and anomaly detection
- ✅ Timing attack detection
- ✅ URL blocking (SSRF protection)
- ✅ Async/await for concurrent scanning

### Database (PostgreSQL)
- ✅ Users table with password hashing
- ✅ Scans table with status tracking
- ✅ Results table with vulnerability details
- ✅ JSONB support for detailed findings

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend API | Node.js 18+ / Express 4.x |
| Scanning Engine | Python 3.9+ / FastAPI |
| Database | PostgreSQL 12+ |
| File Upload | Multer |
| Authentication | JWT + Bcrypt |
| HTTP Client | httpx (Python), axios (Node) |

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+ and pip
- PostgreSQL 12+

### 1. Set up PostgreSQL

```bash
# Create database
createdb api_security_platform

# Verify
psql -l | grep api_security_platform
```

### 2. Set up Node.js Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret

# Start server
npm start
# Server runs on http://localhost:3000
```

### 3. Set up Python Scanner

```bash
cd ../scanner

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with scanner settings

# Start scanner
python -m uvicorn app.main:app --reload --port 8000
# Scanner runs on http://localhost:8000
```

## API Usage

### Authentication

All endpoints except `/auth/*` require JWT token.

#### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

Response:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### Upload and Scan

#### POST /scans
Upload a Postman collection to start a security scan.

```bash
curl -X POST http://localhost:3000/scans \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@collection.json"
```

Response:
```json
{
  "message": "Scan created and queued for processing",
  "scan": {
    "id": 42,
    "status": "pending",
    "endpoints_count": 12,
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

#### GET /scans
List all scans for the authenticated user.

```bash
curl -X GET http://localhost:3000/scans \
  -H "Authorization: Bearer <TOKEN>"
```

Response:
```json
{
  "scans": [
    {
      "id": 42,
      "status": "completed",
      "collection_name": "My API",
      "endpoints_count": 12,
      "created_at": "2024-01-15T10:35:00Z",
      "updated_at": "2024-01-15T10:38:45Z"
    }
  ]
}
```

#### GET /scans/:scanId
Get scan details and vulnerability count.

```bash
curl -X GET http://localhost:3000/scans/42 \
  -H "Authorization: Bearer <TOKEN>"
```

Response:
```json
{
  "scan": {
    "id": 42,
    "user_id": 1,
    "status": "completed",
    "collection_name": "My API",
    "endpoints_count": 12,
    "vulnerability_count": 3,
    "created_at": "2024-01-15T10:35:00Z",
    "updated_at": "2024-01-15T10:38:45Z"
  }
}
```

### View Results

#### GET /results?scanId=42
Get all vulnerabilities for a scan.

```bash
curl -X GET "http://localhost:3000/results?scanId=42" \
  -H "Authorization: Bearer <TOKEN>"
```

Response:
```json
{
  "scan_id": 42,
  "results": [
    {
      "id": 1,
      "endpoint": "https://api.example.com/users",
      "method": "GET",
      "vulnerability": "SQL Injection",
      "severity": "critical",
      "details": {
        "mutation_type": "sql_injection",
        "error_pattern": "SQL syntax"
      },
      "evidence": "Database error exposed: SQL syntax",
      "created_at": "2024-01-15T10:37:30Z"
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

## Postman Collection Format

Expected format (Postman v2.1):

```json
{
  "info": {
    "name": "My Secure API",
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
        "url": {
          "raw": "{{base_url}}/users",
          "protocol": "https",
          "host": ["api", "example", "com"],
          "path": ["users"]
        },
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer token123"
          }
        ]
      }
    },
    {
      "name": "Create User",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/users",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer token123"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{"name":"John","email":"john@example.com"}"
        }
      }
    }
  ]
}
```

## Security Testing Coverage

### Vulnerability Types Detected

1. **SQL Injection**
   - Error-based detection
   - Pattern matching for database errors

2. **NoSQL Injection**
   - Query object injection
   - Operator testing

3. **Command Injection**
   - Shell command payloads
   - Output pattern detection

4. **Authentication Issues**
   - Missing auth validation
   - Broken authentication
   - Weak token handling

5. **Authorization Flaws (IDOR/BOLA)**
   - Response size anomalies
   - Timing differences
   - Status code inconsistencies

6. **XSS (Cross-Site Scripting)**
   - Script reflection detection
   - Event handler testing

7. **XXE (XML External Entity)**
   - Entity injection payloads
   - File read attempts

8. **CORS Misconfiguration**
   - Origin header testing
   - Credential exposure

## Mutation Testing Strategy

The scanner generates multiple variants of each request:

| Mutation Type | Purpose |
|---------------|---------|
| **auth_removal** | Test for missing auth checks |
| **invalid_token** | Detect weak token validation |
| **null_parameters** | Test null value handling |
| **empty_parameters** | Test empty string handling |
| **large_payload** | Fuzz with oversized data |
| **wrong_types** | Type confusion testing |
| **sql_injection** | SQL error detection |
| **nosql_injection** | NoSQL operator injection |
| **command_injection** | Shell command execution |
| **xss** | Script reflection detection |
| **cors_misc** | CORS bypass attempts |

## Environment Configuration

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=api_security_platform
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRES_IN=24h
PYTHON_SCANNER_URL=http://localhost:8000
MAX_FILE_SIZE=10485760
MAX_ENDPOINTS_PER_SCAN=100
MAX_CONCURRENT_SCANS=5
```

### Scanner (.env)
```env
PORT=8000
HOST=localhost
TIMEOUT=30
MAX_RETRIES=3
BLOCKED_HOSTS=localhost,127.0.0.1,0.0.0.0
BLOCKED_NETWORKS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
MAX_REQUESTS_PER_ENDPOINT=50
NODE_BACKEND_URL=http://localhost:3000
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Scans Table
```sql
CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  collection_name VARCHAR(255),
  endpoints_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Results Table
```sql
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  endpoint VARCHAR(500),
  method VARCHAR(10),
  vulnerability VARCHAR(100),
  severity VARCHAR(20),
  details JSONB,
  evidence TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Scan Status Flow

```
pending → running → completed
              ↓
            failed
```

- **pending**: Queued, waiting for scanner to start
- **running**: Scanner is actively testing endpoints
- **completed**: All tests finished, results stored
- **failed**: Error occurred during scanning

## Error Handling

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async processing) |
| 400 | Invalid input (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Not found |
| 409 | Conflict (email already exists) |
| 500 | Server error |

### Error Response Format
```json
{
  "error": "Error message describing the problem"
}
```

## Production Deployment

### Docker (Optional)

```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```dockerfile
# scanner/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: api_security_platform
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      PYTHON_SCANNER_URL: http://scanner:8000
    depends_on:
      - postgres

  scanner:
    build: ./scanner
    ports:
      - "8000:8000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

## Security Best Practices

1. **ALWAYS change JWT_SECRET in production**
2. **Use HTTPS in production**
3. **Never expose database credentials**
4. **Use environment variables for sensitive data**
5. **Enable rate limiting on public endpoints**
6. **Validate all user input**
7. **Use parameterized queries (done)**
8. **Block SSRF targets (done)**
9. **Implement request size limits**
10. **Add API rate limiting**

## Troubleshooting

### Cannot connect to PostgreSQL
```bash
# Check if PostgreSQL is running
psql -U postgres -d api_security_platform

# Verify credentials in .env match
```

### Python scanner not responding
```bash
# Check if Python service is running
curl http://localhost:8000/health

# Check logs for errors
tail -f scanner.log
```

### File upload fails
```
Max file size: 10 MB (configurable)
Required format: JSON only
```

## Performance Considerations

- **Scan timeout**: 5 minutes per scan job
- **Request timeout**: 30 seconds per endpoint
- **Max endpoints per collection**: 100 (configurable)
- **Max file size**: 10 MB (configurable)
- **Database indexes**: User ID, scan status, scan ID

## Contributing

When extending the scanner:

1. Add mutation types to `mutation_engine.py`
2. Add detection patterns to `response_analyzer.py`
3. Update documentation
4. Test with sample collections

## License

MIT

## Support

For issues, questions, or improvements, please refer to the project documentation.
