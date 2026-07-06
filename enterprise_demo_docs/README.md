# Enterprise Demo Documentation

This directory documents the current deliverable state of Enterprise Demo. It is not a phase plan or backlog.

## Scope

Enterprise Demo is a production-style admin template with:

- Go + Echo backend.
- PostgreSQL persistence.
- JWT authentication, slider captcha, RBAC menus, route permissions, and button permissions.
- Data-scope examples through customer management.
- React + Vite + Ant Design frontend.
- Dashboard, monitor, scheduler, recycle bin, data dictionary, file upload/download, audit logs, settings, and knowledge base.
- Notifications, message templates, approvals, workflows, AI assistant, streaming AI chat history, and internal instant messaging.
- Kafka, RabbitMQ, TCP, UDP, and MQTT experience pages for queue and IoT protocol demonstrations.
- Frontend and backend XLSX download examples.

Unfinished modules must not appear in runtime menus, frontend routes, backend routes, seed data, or OpenAPI.

## Documents

- `api_design.md`: current backend API surface.
- `database_design.md`: current database tables and persistence rules.
- `frontend_pages.md`: current frontend page map and UI behavior.

## Verification

Before shipping changes:

```bash
cd backend && go test ./...
cd frontend && npm run build
```

For full frontend unit coverage:

```bash
cd frontend && npx vitest run src
```
