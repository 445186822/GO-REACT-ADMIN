# Frontend Pages

The frontend is a React + TypeScript + Vite admin app using Ant Design and Ant Design ProComponents.

## Routing and Menu Rules

Routes live in `frontend/src/routes/AppRouter.tsx`. The side menu is loaded from `/api/v1/auth/me`, then filtered to implemented route paths in `BasicLayout`.

Do not add placeholder routes. If a module is not backed by real database tables, backend APIs, permissions, and UI behavior, it must not appear in the menu.

## Current Pages

- `/login`: database-backed login.
- `/dashboard`: admin overview.
- `/system/users`: user list, create, update, soft delete, frontend XLSX export.
- `/system/roles`: role list and frontend XLSX export.
- `/system/menus`: menu/permission list and frontend XLSX export.
- `/system/departments`: department list and frontend XLSX export.
- `/business/customers`: customer CRUD, data-scope API integration, backend XLSX export.
- `/files`: upload, list, backend file download, soft delete, frontend file-list XLSX export.
- `/logs/operation`: audit log list and frontend XLSX export.
- `/settings`: list and upsert settings, frontend XLSX export.

Unknown routes render a 404 page instead of redirecting to the dashboard.

## Download Source Labels

Download buttons distinguish source:

- `前端`: browser-generated XLSX using `write-excel-file`.
- `后端`: backend-generated file stream or backend XLSX response.

Customer export and file downloads are backend downloads. Other list exports are currently frontend-generated.

## State and API Access

- Auth state, current user, menu tree, and permissions are stored in Zustand.
- API calls use `frontend/src/request/http.ts`.
- Permission-gated buttons use `frontend/src/components/Permission.tsx`.

## Build Verification

```bash
cd frontend
npm run build
```
