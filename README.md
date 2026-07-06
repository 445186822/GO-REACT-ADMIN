# Enterprise Demo

Enterprise Demo is a production-style enterprise admin application. It uses a Go + Echo backend, PostgreSQL persistence, Redis-backed runtime features where configured, and a React + Vite + Ant Design frontend.

The project must not expose unfinished modules at runtime. Planned features must stay out of menus, frontend routes, backend routes, OpenAPI, seed data, and completion claims until they have real tables, APIs, permissions, UI, and verification.

## Current Implemented Scope

- Backend Echo server with configuration, structured logging, request ID, CORS, recovery, unified responses, and OpenAPI route coverage tests.
- PostgreSQL migration runner and required system metadata initialization.
- JWT login, refresh, password change, current-user API, slider captcha, RBAC menus, and route-level permission enforcement.
- Users, roles, menus, departments, data dictionaries, recycle bin, scheduler, monitor, dashboard, settings, files, audit logs, and customer management.
- Collaboration modules: notifications, message templates, approvals, workflow definitions/runtime, AI assistant storage/provider forwarding, and streaming AI chat history.
- Full internal chat module with sessions, participants, messages, attachments, read state, recall, settings, member management, and WebSocket updates.
- Message and protocol experience pages: Kafka, RabbitMQ, TCP, UDP, and MQTT. IoT protocol messages can be bridged into Kafka topics or RabbitMQ queues for consumption.
- React + TypeScript + Vite + Ant Design admin shell with lazy routes, tabbed workspace, theme controls, permission wrappers, and error boundary.
- Docker Compose infrastructure for PostgreSQL and Redis.

## Development Commands

Use the repository script for normal local development. It uses backend port `18080` and frontend port `15173`.

```bash
enterprise-demo.bat start
enterprise-demo.bat stop
enterprise-demo.bat restart
enterprise-demo.bat status
```

The script expects PostgreSQL on `5432`, Redis on `6379`, Go, npm, and installed frontend dependencies.

Start infrastructure:

```bash
docker compose up -d
```

Backend verification:

```bash
cd backend
go mod tidy
go test ./...
```

Frontend verification:

```bash
cd frontend
npm install
npm run build
```

## Environment

Copy `backend/.env.example` to `backend/.env` and set secrets before first startup.

```bash
INITIAL_ADMIN_PASSWORD=<set-a-real-initial-admin-password>
JWT_SECRET=<set-a-long-random-secret>
```

`INITIAL_ADMIN_PASSWORD` is only used when the `admin` account does not yet exist. Existing admin passwords are not overwritten by startup.

Queue/protocol labs require Kafka and RabbitMQ configuration in `backend/.env` when those pages are used.

## Repository Layout

- `backend/`: Go + Echo API service, migrations, OpenAPI, and backend runtime configuration.
- `frontend/`: React + Vite admin app.
- `enterprise_demo_docs/`: current product documentation for API, database, and frontend behavior.
- `docs/`: engineering notes that are still current, including technical debt tracking.
- `docker-compose.yml`: local PostgreSQL and Redis infrastructure.

## No Mock Policy

- Do not add placeholder pages to menus or routes.
- Do not return canned data from backend endpoints.
- Do not seed fake business records as completed functionality.
- Do not hardcode demo passwords or real secrets in source code.
- Keep unfinished modules out of runtime visibility and documentation.
