# Repository Guidelines

## Project Structure & Module Organization

This repository is a monorepo. `backend/` contains the Go + Echo API service, migrations, OpenAPI spec, and backend runtime configuration. `frontend/` contains the React + Vite admin app. `enterprise_demo_docs/` contains current product documentation. Root files such as `docker-compose.yml`, `.gitignore`, and `README.md` are shared repository or infrastructure files.

Do not expose unfinished modules at runtime. Planned features such as orders, tasks, approvals, WebSocket notifications, and AI chat must stay out of backend routes, frontend routes, seed menus, and OpenAPI until fully implemented.

## Build, Test, and Development Commands

Backend:

```bash
cd backend
go mod tidy
go run ./cmd/api
go test ./...
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
```

Infrastructure:

```bash
docker compose up -d
```

`npm run build` performs TypeScript checks and production Vite build. `go test ./...` runs all backend package tests.

## Coding Style & Naming Conventions

Use `gofmt` for Go files. Keep backend modules under `backend/internal/modules/<domain>/handler.go`. React components use PascalCase, hooks and helpers use camelCase, and feature pages live under `frontend/src/features/<feature>/pages/`.

Keep edits scoped. Prefer existing API helpers, Zustand store patterns, Ant Design components, and local permission wrappers.

## Testing Guidelines

Run `go test ./...` before backend commits and `npm run build` before frontend commits. Add focused tests when changing shared behavior, data-scope rules, auth, export/download logic, or route/menu visibility.

## Commit & Pull Request Guidelines

Current history uses short imperative messages, for example `Add backend customer XLSX export`. Keep commits focused and describe the behavior changed. Pull requests should include a summary, verification commands, screenshots for UI changes, and notes for any database, migration, or environment changes.

## Security & Configuration Tips

Runtime secrets belong in `backend/.env`; never commit real `.env` files. Use `backend/.env.example` for documented defaults. Uploaded files and build outputs are ignored and should not be committed.
