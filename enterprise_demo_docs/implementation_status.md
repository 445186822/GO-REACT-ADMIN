# Implementation Status

Last updated: 2026-06-23

## Completed Without Mock

- Project startup: Docker Compose for PostgreSQL and Redis.
- Backend base: Echo, config, structured logger, request ID, recover, CORS, unified response, unified error handler.
- Database: migration runner, PostgreSQL connection pool, required system metadata initialization.
- Authentication: real database-backed login, refresh token, current user, JWT middleware.
- Admin shell: React, Vite, Ant Design layout, authenticated route guard, backend-driven menu.
- System pages: users, roles list, menus list, departments list.
- Business page: customer CRUD with database-backed data-scope filtering.
- File center: upload, list, download, soft delete, local storage, database metadata.
- Audit logs: non-GET API audit middleware and audit log query page.
- Settings: database-backed setting list and upsert page.
- Excel export: current list pages provide real `.xlsx` export from authorized API data. This is acceptable for small and medium result sets; large exports and strict audit exports should move to backend-generated streaming `.xlsx` endpoints.
- OpenAPI: updated to the currently implemented real API surface.

## Not Completed Yet

- Backend permission middleware that enforces permission codes per API route.
- Role CRUD, menu CRUD, department CRUD, role-menu authorization UI.
- User detail, status patch, reset password, role assignment.
- Order master-detail module.
- Task state transition module.
- Approval center.
- Real WebSocket notification system with notification table and business event triggers.
- Real AI chat with conversation persistence and actual streaming model/provider integration.
- Automated backend and frontend test coverage beyond build/package checks.
- Backend-generated `.xlsx` export endpoints for the remaining list pages beyond customers.

## Runtime Visibility Rule

Only completed modules may be registered in backend routes, frontend routes, seed menus, and OpenAPI. Unfinished modules must stay invisible at runtime until their real implementation is complete.
