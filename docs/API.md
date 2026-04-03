# API Endpoints Documentation

## Timeline

All timestamps are in UTC ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (201 Created):**
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

**Error Responses:**
- `400 Bad Request`: Missing email or password, or password too short
- `409 Conflict`: Email already registered

---

### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
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

**Error Responses:**
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials

---

## Scan Endpoints

### POST /scans
Upload a Postman collection and start a security scan.

**Headers:**
- `Authorization: Bearer <TOKEN>` (required)
- `Content-Type: multipart/form-data`

**Request:**
- `file`: JSON file (Postman collection format)

**Response (202 Accepted):**
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

**Error Responses:**
- `400 Bad Request`: No file, invalid JSON, or invalid Postman format
- `401 Unauthorized`: Missing or invalid token
- `413 Payload Too Large`: File exceeds maximum size
- `422 Unprocessable Entity`: Collection exceeds maximum endpoints

---

### GET /scans
List all scans for the authenticated user (paginated).

**Headers:**
- `Authorization: Bearer <TOKEN>` (required)

**Query Parameters:**
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset (default: 0)

**Response (200 OK):**
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
    },
    {
      "id": 41,
      "status": "running",
      "collection_name": "Another API",
      "endpoints_count": 8,
      "created_at": "2024-01-15T09:20:00Z",
      "updated_at": "2024-01-15T09:22:15Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token

---

### GET /scans/:scanId
Get details of a specific scan.

**Headers:**
- `Authorization: Bearer <TOKEN>` (required)

**Path Parameters:**
- `scanId`: Scan ID (integer)

**Response (200 OK):**
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

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Scan not found or belongs to different user

---

## Results Endpoints

### GET /results
Get all vulnerabilities found in a specific scan.

**Headers:**
- `Authorization: Bearer <TOKEN>` (required)

**Query Parameters:**
- `scanId`: Scan ID (integer, required)
- `severity`: Filter by severity (critical, high, medium, low)
- `vulnerability`: Filter by vulnerability type

**Response (200 OK):**
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
    },
    {
      "id": 2,
      "endpoint": "https://api.example.com/orders/123",
      "method": "GET",
      "vulnerability": "Potential Data Exposure (IDOR/BOLA)",
      "severity": "high",
      "details": {
        "mutation_type": "auth_removal",
        "baseline_size": 2048,
        "mutated_size": 4096
      },
      "evidence": "Response size significantly increased without authentication",
      "created_at": "2024-01-15T10:37:45Z"
    }
  ],
  "statistics": {
    "total": 2,
    "by_severity": {
      "critical": 1,
      "high": 1,
      "medium": 0,
      "low": 0
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing scanId parameter
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Scan not found

---

### GET /results/:resultId
Get detailed information about a specific vulnerability finding.

**Headers:**
- `Authorization: Bearer <TOKEN>` (required)

**Path Parameters:**
- `resultId`: Result ID (integer)

**Response (200 OK):**
```json
{
  "result": {
    "id": 1,
    "scan_id": 42,
    "endpoint": "https://api.example.com/users",
    "method": "GET",
    "vulnerability": "SQL Injection",
    "severity": "critical",
    "details": {
      "mutation_type": "sql_injection",
      "error_pattern": "SQL syntax",
      "baseline_status": 200,
      "mutated_status": 200
    },
    "evidence": "Database error exposed: SQL syntax",
    "created_at": "2024-01-15T10:37:30Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Result not found or belongs to different user

---

## Microsoft/Health Endpoint

### GET /health
Check if the backend service is running.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:40:00Z"
}
```

---

## Status Codes Summary

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful registration |
| 202 | Accepted | Scan job accepted (async) |
| 400 | Bad Request | Invalid input or validation error |
| 401 | Unauthorized | Missing or invalid JWT token |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Email already registered |
| 413 | Payload Too Large | File exceeds size limit |
| 422 | Unprocessable Entity | Validation failed (e.g., too many endpoints) |
| 500 | Internal Server Error | Server error |

---

## JSON Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing the problem"
}
```

---

## Rate Limiting

The following rate limits apply:

| Endpoint | Limit | Window |
|----------|-------|--------|
| /auth/register | 5 requests | 1 hour |
| /auth/login | 10 requests | 15 minutes |
| /scans | 100 requests | 15 minutes |
| /results | 100 requests | 15 minutes |

When rate limited, the response is:
```
HTTP/1.1 429 Too Many Requests
{
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## Example cURL Requests

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123"}'
```

### Upload Postman Collection
```bash
curl -X POST http://localhost:3000/scans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@collection.json"
```

### Get Scan Status
```bash
curl -X GET http://localhost:3000/scans/42 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Vulnerability Results
```bash
curl -X GET "http://localhost:3000/results?scanId=42" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Vulnerability Types Reference

| Vulnerability | Severity | Description |
|---|---|---|
| SQL Injection | Critical | Database query manipulation |
| Command Injection | Critical | OS command execution |
| Broken Authentication | Critical | Auth bypass or weak validation |
| NoSQL Injection | High | NoSQL query manipulation |
| Cross-Site Scripting (XSS) | High | Script injection into responses |
| XML External Entity (XXE) | High | Entity injection attacks |
| Potential Data Exposure (IDOR/BOLA) | High | Unauthorized data access |
| CORS Misconfiguration | Medium | Cross-origin resource policy flaw |
| Improper Input Validation | Medium | Invalid data acceptance |
| Timing Anomaly Detected | Low | Potential timing-based attacks |
| Authentication Bypass | Critical | API access without credentials |
| Missing Security Headers | Medium | Absent protective headers |

