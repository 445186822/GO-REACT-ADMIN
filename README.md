# Enterprise Demo

Enterprise Demo is being built as a production-style enterprise admin application. The project must not expose mock pages, mock APIs, canned stream responses, or seeded sample business data as completed functionality.

## Current Implemented Scope

- Backend Echo server, configuration, structured logging, request ID, CORS, recovery, and unified responses.
- PostgreSQL connection, migration runner, and required system metadata initialization.
- Real JWT login, refresh token, and current-user API backed by `sys_users`.
- Authenticated APIs for users, roles list, menus, departments, customers, files, audit logs, settings, notifications, message templates, approvals, workflows, and AI assistant messages.
- WebSocket notification updates backed by persisted notification records.
- Local file storage with persisted file metadata.
- Non-GET API audit logging persisted to `sys_audit_logs`.
- React + TypeScript + Vite + Ant Design admin shell.
- Login, dashboard, users, roles, menus, departments, customers, collaboration modules, files, audit logs, and settings pages wired to backend APIs.
- Docker Compose for PostgreSQL and Redis.

## No Mock Policy

- Do not add placeholder pages to the menu or router.
- Do not return canned data from backend endpoints.
- Do not seed sample business data.
- Do not hardcode demo passwords in source code.
- Keep unfinished modules out of menus, routes, OpenAPI completion lists, and README completion claims.

## Repository Layout

This repository is organized as a monorepo:

- `backend/`: Go + Echo API service, migrations, OpenAPI, and backend runtime configuration.
- `frontend/`: React + Vite admin app and frontend build configuration.
- `enterprise_demo_docs/`: current product documentation for API, database, and frontend behavior.
- `docker-compose.yml`: shared local infrastructure for PostgreSQL and Redis.

Root-level files are shared repository or infrastructure files. Backend runtime environment files live under `backend/`.

## Environment

Copy `backend/.env.example` to `backend/.env` and set required secrets before first startup.

```bash
INITIAL_ADMIN_PASSWORD=<set-a-real-initial-admin-password>
JWT_SECRET=<set-a-long-random-secret>
```

`INITIAL_ADMIN_PASSWORD` is only used when the `admin` account does not yet exist. Existing admin passwords are not overwritten by startup.

## Start Infrastructure

```bash
docker compose up -d
```

## Start Backend

```bash
cd backend
copy .env.example .env
go mod tidy
go run ./cmd/api
```

Backend default address:

```text
http://localhost:8080
```

Health checks:

```text
GET http://localhost:8080/health
GET http://localhost:8080/api/v1/health
```

## Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default address:

```text
http://localhost:5173
```

Login with the real `admin` account and the password configured by `INITIAL_ADMIN_PASSWORD` during first initialization.

## Extension Rule

Additional modules such as orders and tasks may be added later. They must not be exposed in routes, menus, OpenAPI, or product documentation until they have real tables, APIs, frontend pages, permissions, and verification.

AI assistant chat requires a real backend integration endpoint:

```bash
AI_ASSISTANT_ENDPOINT=<https endpoint returning {"reply":"..."} >
AI_ASSISTANT_API_KEY=<optional bearer token>
```
