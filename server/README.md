# Gamified Social Server

Production backend for auth and user-account APIs using Express, MongoDB, JWT, and role-based access control.

## Local Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - `cp .env.example .env`
3. Start MongoDB locally.
4. Run server:
   - `npm run dev`

Server default URL: `http://localhost:4000`

## Health Check

- `GET /api/health`

Example:

```bash
curl http://localhost:4000/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "gamified-social-server",
  "database": "connected",
  "timestamp": "2026-06-28T00:00:00.000Z"
}
```

## Seeded Default Admin (Local Dev)

On startup, backend ensures this account exists:

- email: `admin@company.com`
- password: `Password123!`
- role: `admin`

## Auth API

### POST /api/auth/login

Request:

```json
{
  "email": "admin@company.com",
  "password": "Password123!"
}
```

Response shape:

```json
{
  "ok": true,
  "message": "Login successful",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "id": "...", "email": "admin@company.com", "role": "admin" }
  }
}
```

### POST /api/auth/refresh

Request:

```json
{
  "refreshToken": "..."
}
```

Response shape:

```json
{
  "ok": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "id": "...", "email": "admin@company.com", "role": "admin" }
  }
}
```

### POST /api/auth/logout

Headers:
- `Authorization: Bearer <accessToken>`

Request:

```json
{
  "refreshToken": "..."
}
```

Response shape:

```json
{
  "ok": true,
  "message": "Logout successful",
  "data": {
    "loggedOut": true
  }
}
```

### GET /api/auth/profile

Headers:
- `Authorization: Bearer <accessToken>`

Response shape:

```json
{
  "ok": true,
  "message": "Profile fetched",
  "data": {
    "user": { "id": "...", "email": "admin@company.com", "role": "admin" }
  }
}
```

## User Accounts API

### Roles
Supported roles:
- `admin`
- `hr`
- `accountant`
- `employee`

### POST /api/users

Access: `admin` only.

Creates user with bcrypt password hash.

### GET /api/users

Access: `admin`, `hr`, `accountant`.

### PATCH /api/users/:id

Access: `admin`, `hr`.

### PATCH /api/users/:id/sales

Access: `admin`, `accountant`.

## Quick Local Test Commands

```bash
# Health
curl http://localhost:4000/api/health

# Login admin
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Password123!"}'
```

Use returned `accessToken` for protected routes and `refreshToken` for `/api/auth/refresh`.
