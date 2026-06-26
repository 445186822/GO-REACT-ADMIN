# Enterprise Demo Documentation

This directory documents the current deliverable state of Enterprise Demo. It is intentionally not a phase plan or backlog.

## Scope

Enterprise Demo is a production-style admin template with:

- Go + Echo backend.
- PostgreSQL persistence.
- JWT authentication.
- RBAC menu and button permissions.
- Data-scope example through customer management.
- React + Vite + Ant Design frontend.
- File upload/download, audit logs, and settings.
- Notifications, message templates, approvals, workflows, and AI assistant chat storage.
- Frontend and backend XLSX download examples.

Unfinished modules must not appear in runtime menus, frontend routes, backend routes, seed data, or OpenAPI. Planned-but-not-implemented features such as orders and tasks are excluded from these docs until they are real.

## Documents

- `api_design.md`: current public backend API surface.
- `database_design.md`: current database tables and persistence rules.
- `frontend_pages.md`: current frontend page map and UI behavior.

## Repository Layout

```text
backend/                Go API service
frontend/               React admin app
enterprise_demo_docs/   Current product documentation
docker-compose.yml      Local PostgreSQL and Redis
```

## Verification

Before shipping changes:

```bash
cd backend && go test ./...
cd frontend && npm run build
```
