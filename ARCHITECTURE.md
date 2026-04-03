# Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      User/Client Layer                       │
│                   (Postman, cURL, etc.)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS
                         │
       ┌─────────────────▼────────────────────────┐
       │  API Gateway / Load Balancer (Nginx)    │
       │  - Request routing                      │
       │  - SSL/TLS termination                  │
       │  - Rate limiting                        │
       └────────────────┬─────────────────────────┘
                        │
       ┌────────────────▼─────────────────────────┐
       │   Node.js/Express Backend                │
       │   ┌────────────────────────────────────┐ │
       │   │ Auth Service                       │ │
       │   │ - JWT token generation             │ │
       │   │ - Password hashing (bcrypt)        │ │
       │   └────────────────────────────────────┘ │
       │   ┌────────────────────────────────────┐ │
       │   │ File Upload Service (Multer)       │ │
       │   │ - JSON validation                  │ │
       │   │ - Postman format parsing           │ │
       │   │ - Size limits                      │ │
       │   └────────────────────────────────────┘ │
       │   ┌────────────────────────────────────┐ │
       │   │ Scan Service                       │ │
       │   │ - Job creation                     │ │
       │   │ - Status tracking                  │ │
       │   │ - HTTP communication               │ │
       │   └────────────────────────────────────┘ │
       │   ┌────────────────────────────────────┐ │
       │   │ Results Management                 │ │
       │   │ - Storage                          │ │
       │   │ - Aggregation                      │ │
       │   │ - Filtering                        │ │
       │   └────────────────────────────────────┘ │
       └────────────────┬─────────────────────────┘
                        │
       ┌────────────────┴─────────────────────────┐
       │                                           │
       │ HTTP (JSON)        ┌────────────────┐   │ PostgreSQL
       │                    │ Database Conn  │   │ (TCP 5432)
       ├──────────────────► │ Pool           │   │
       │                    └────────────────┘   │
       │                         │                │
       │                         │                │
       │                    ┌────▼─────────────┐ │
       │                    │ PostgreSQL DB    │◄─┤
       │                    │ Tables:          │ │
       │                    │ - users          │ │
       │                    │ - scans          │ │
       │                    │ - results        │ │
       │                    └──────────────────┘ │
       │                                          │
       └──────────────────────────────────────────┘
                        │
                        │ HTTP POST (JSON)
                        │ /scan endpoint
                        │
       ┌────────────────▼──────────────────────┐
       │  Python/FastAPI Scanner Service       │
       │  ┌──────────────────────────────────┐ │
       │  │ Request Executor                 │ │
       │  │ - HTTP client (httpx)            │ │
       │  │ - SSRF protection                │ │
       │  │ - Timeout/retry logic            │ │
       │  │ - Async/concurrent requests      │ │
       │  └──────────────────────────────────┘ │
       │  ┌──────────────────────────────────┐ │
       │  │ Mutation Engine                  │ │
       │  │ - Parameter mutators             │ │
       │  │ - Injection payload generators   │ │
       │  │ - Header manipulators            │ │
       │  │ - Fuzzing strategies             │ │
       │  └──────────────────────────────────┘ │
       │  ┌──────────────────────────────────┐ │
       │  │ Response Analyzer                │ │
       │  │ - Pattern matching               │ │
       │  │ - Error detection                │ │
       │  │ - Timing analysis                │ │
       │  │ - Vulnerability scoring          │ │
       │  └──────────────────────────────────┘ │
       └───────────────────────────────────────┘
                        │
                 Tested APIs
                        │
       ┌────────────────▼──────────────────────┐
       │ Target API Servers (Client's APIs)   │
       │ - User specifies endpoints            │
       │ - Scanner tests each endpoint         │
       │ - Results returned                    │
       └───────────────────────────────────────┘
```

## Data Flow

### 1. User Registration & Authentication

```
User Login Request
      │
      ▼
JWT Verification ─────────────────►OK/Fail
      │ (JWT Token issued)
      ▼
Request Authorization
      │
      ▼
Include in subsequent requests
```

### 2. Scan Workflow

```
1. Upload Postman Collection
        │
        ▼
2. JSON Validation (Multer)
        │
        ▼
3. Parse Collection
   - Extract requests
   - Resolve variables
   - Normalize format
        │
        ▼
4. Create Scan Record (DB)
   - Status: pending
   - Store metadata
        │
        ▼
5. HTTP POST to Python Scanner
   {
     "scan_id": 42,
     "user_id": 1,
     "requests": [...]
   }
        │
        ▼
6. Python Scanner Processing
   FOR EACH request:
     a. Get baseline response
     b. Generate mutations
     FOR EACH mutation:
       - Execute mutated request
       - Analyze response
       - Detect vulnerabilities
     c. Aggregate findings
        │
        ▼
7. Return Results JSON
   {
     "scan_id": 42,
     "vulnerabilities": [...]
   }
        │
        ▼
8. Store Results (DB)
   - Create result records
   - Update scan status: completed
        │
        ▼
9. Client Retrieves Results
   GET /results?scanId=42
```

### 3. Mutation Testing Process

```
Original Request: GET /api/users
        │
        ├─► Mutation 1: Remove Auth Header
        │        │
        │        ├─ Execute request
        │        ├─ Get response
        │        └─ Compare: Denied?
        │
        ├─► Mutation 2: SQL Injection Payload
        │        │
        │        ├─ Execute request
        │        ├─ Get response
        │        └─ Check for DB errors
        │
        ├─► Mutation 3: Null Parameters
        │        │
        │        ├─ Execute request
        │        ├─ Get response
        │        └─ Detect anomalies
        │
        ├─► Mutation 4: Large Payload
        │        │
        │        ├─ Execute request
        │        ├─ Get response
        │        └─ Check size change
        │
        └─► ... more mutations
                 │
                 ▼
        Consolidated Findings
        [
          {
            endpoint: "/api/users",
            vulnerability: "Broken Auth",
            severity: "critical"
          },
          ...
        ]
```

## Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐
│     USERS        │
├──────────────────┤
│ id (PK)          │
│ email (UNIQUE)   │
│ password_hash    │
│ created_at       │
└────────┬─────────┘
         │ 1
         │
         │ (1:N)
         │
         │ N
         ▼
┌──────────────────┐
│     SCANS        │
├──────────────────┤
│ id (PK)          │
│ user_id (FK) ────┼─────────► User
│ status           │
│ collection_name  │
│ endpoints_count  │
│ created_at       │
│ updated_at       │
└────────┬─────────┘
         │ 1
         │
         │ (1:N)
         │
         │ N
         ▼
┌──────────────────────────┐
│     RESULTS              │
├──────────────────────────┤
│ id (PK)                  │
│ scan_id (FK) ────────────┼─────► Scan
│ endpoint                 │
│ method                   │
│ vulnerability            │
│ severity                 │
│ details (JSONB)          │
│ evidence                 │
│ created_at               │
└──────────────────────────┘
```

### Indexes

```
- users(email) - For login queries
- scans(user_id) - For user's scans listing
- scans(status) - For filtering by status
- results(scan_id) - For vulnerability lookup
```

## Security Architecture

### SSRF Protection (Server-Side Request Forgery)

```
User Input (URL from Postman)
        │
        ▼
URL Validation
├─ Parse hostname
├─ Check against blocklist:
│  ├─ localhost / 127.0.0.1
│  ├─ 0.0.0.0
│  └─ Private IP ranges:
│     ├─ 10.0.0.0/8
│     ├─ 172.16.0.0/12
│     ├─ 192.168.0.0/16
│     └─ 169.254.0.0/16 (link-local)
└─ DNS resolution check
        │
        ├─ BLOCKED ──► Reject Request
        │
        └─ ALLOWED ──► Execute Request
```

### Authentication Flow

```
Client Request
        │
        ├─ Check Authorization Header
        │        │
        │        ├─ Missing ──► 401 Unauthorized
        │        │
        │        └─ Present ──► Extract Token
        │                │
        │                ▼
        │        JWT Verification
        │        ├─ Signature valid?
        │        ├─ Not expired?
        │        └─ Contains user_id?
        │                │
        │        ┌───────┴───────┐
        │        │ (Invalid)     │ (Valid)
        │        ▼               ▼
        │       401             Attach user info
        │                       to request
        │
        └──────► Process Request
```

### Input Validation Strategy

```
File Upload
        │
        ├─ MIME type check → application/json only
        ├─ File size check → Max 10 MB
        └─ JSON schema validation
            │
            ├─ Valid Postman v2.1 format?
            ├─ Has "item" array?
            └─ Has "info" object?
                │
        ┌───────┴───────┐
        │               │
     INVALID         VALID
        │               │
        ▼               ▼
    400 Error      Parse Collection
                        │
                        ├─ Recursively extract requests
                        ├─ Validate each request:
                        │  ├─ Has URL?
                        │  ├─ Valid method?
                        │  └─ Headers valid?
                        │
                        └─► Create Scan Job
```

## Performance Considerations

### Concurrency Model

```
Backend (Node.js/Express)
├─ Non-blocking I/O
├─ Promise-based (async/await)
├─ Connection pool for DB
└─ Handles multiple users simultaneously

Scanner (Python/FastAPI)
├─ Async request execution
├─ Limits per endpoint:
│  └─ 50 mutations max per endpoint
├─ Timeout: 30 seconds per request
├─ Retry: Up to 3 attempts
└─ Concurrent requests within limits
```

### Database Connection Pool

```
┌─ Backend ─────────────┐
│                        │
│ ┌─────────────────┐   │
│ │ Connection Pool │   │ 10 connections
│ │ ┌─ Connection 1 │   │ (configurable)
│ │ ├─ Connection 2 │   │
│ │ ├─ Connection 3 │   │
│ │ └─ ...          │   │
│ └─────────────────┘   │
│        │              │
└────────┼──────────────┘
         │ (Reuses connections)
         ▼
    PostgreSQL
```

### Memory Usage Patterns

```
Scan Processing:
- Parse collection: O(n) where n = number of endpoints
- Store mutations in memory: O(n * m) where m = mutations per endpoint
- Process baseline: O(1) per endpoint
- Process mutations: O(m) per endpoint

Recommendations:
- Limit endpoints: 100
- Limit mutations: 50 per endpoint max
- Monitor memory during large scans
```

## Error Handling Strategy

```
Request Fails
        │
        ├─ Network error
        │  ├─ Timeout ──► Retry (max 3)
        │  ├─ DNS fail ──► Skip endpoint
        │  └─ Connection refused ──► Log and continue
        │
        ├─ Response error (4xx, 5xx)
        │  └─ Still analyze response
        │
        └─ Application error
           ├─ SQL error ──► Log, update scan status to failed
           ├─ JSON parse error ──► Skip that part
           └─ Scanner crash ──► Rollback and retry
```

## Deployment Patterns

### Local Development

```
┌─────────────────────────────────────┐
│ Developer Machine                   │
│                                     │
│ Terminal 1: npm start (backend)     │
│ Terminal 2: uvicorn (scanner)       │
│ Terminal 3: psql (postgres)         │
│ Terminal 4: curl (test requests)    │
│                                     │
└─────────────────────────────────────┘
```

### Docker Development

```
┌─────────────────────────────────────────┐
│ Docker Network                          │
│                                         │
│ ┌──────────┐ ┌────────┐ ┌────────────┐ │
│ │ Backend  │ │Scanner │ │ PostgreSQL │ │
│ │Container │ │Containt│ │ Container  │ │
│ └──────────┘ └────────┘ └────────────┘ │
│      ▲          ▲              ▲        │
│      └──────────┴──────────────┘        │
│      Named network communication        │
│                                         │
└─────────────────────────────────────────┘
```

### Production Deployment

```
┌──────────────────────────────────────────────┐
│ Load Balancer / Nginx                        │
│ - SSL/TLS termination                        │
│ - Request routing                            │
└──────────────────┬───────────────────────────┘
                   │
       ┌───────────┼──────────────┐
       │           │              │
       ▼           ▼              ▼
   ┌────────┐ ┌────────┐ ┌──────────┐
   │Backend │ │Backend │ │ Backend  │
   │Pod 1   │ │Pod 2   │ │ Pod 3    │
   └────────┘ └────────┘ └──────────┘
         └─────────┬─────────┘
                   │
       ┌───────────┼──────────────┐
       │           │              │
       ▼           ▼              ▼
   ┌────────┐ ┌────────┐ ┌──────────┐
   │Scanner │ │Scanner │ │ Scanner  │
   │Pod 1   │ │Pod 2   │ │ Pod 3    │
   └────────┘ └────────┘ └──────────┘
                   │
       ┌───────────┴──────────────┐
       │                          │
       ▼                          ▼
   ┌──────────────┐      ┌────────────────┐
   │ PostgreSQL   │─────►│ PostgreSQL      │
   │ Primary      │      │ Replica         │
   └──────────────┘      └────────────────┘
                         (Read replicas)
```

## Monitoring & Logging

```
┌────────────────────────────────────┐
│ Backend Logs                       │
├────────────────────────────────────┤
│ - Request/response logs            │
│ - Database query logs              │
│ - Error stack traces               │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Scanner Logs                       │
├────────────────────────────────────┤
│ - Request execution logs           │
│ - Mutation testing progress        │
│ - Response analysis results        │
│ - Error handling logs              │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Database Logs                      │
├────────────────────────────────────┤
│ - Query execution logs             │
│ - Connection pool status           │
│ - Slow query logs                  │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Metrics to Monitor                 │
├────────────────────────────────────┤
│ - Request count & latency          │
│ - Database connection pool usage   │
│ - Scan completion time             │
│ - Vulnerability detection rate     │
│ - Error rate per component         │
└────────────────────────────────────┘
```

