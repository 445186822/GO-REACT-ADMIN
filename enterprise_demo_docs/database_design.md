# Database Design

The application uses PostgreSQL. Migrations live in `backend/migrations/` and are applied by the backend migration runner at startup.

## Core System Tables

- `sys_users`: login users, profile fields, status, department relation, password hash, and super-admin flag.
- `sys_roles`: role metadata.
- `sys_user_roles`: user-role assignments.
- `sys_menus`: directories, pages, and button permissions in one tree.
- `sys_role_menus`: role-menu assignments plus `data_scope`.
- `sys_departments`: department hierarchy metadata.
- `sys_settings`: persisted system settings.
- `sys_audit_logs`: non-GET API audit records.
- `sys_files`: uploaded file metadata and storage path.

All mutable business/system tables use soft deletion through `deleted_at` where applicable.

## Business Tables

- `biz_customers`: customer records used to demonstrate CRUD, soft delete, owner/department fields, and data-scope filtering.

Customer data is real user-created data. Seed data must not include demo customers or other fake business records.

## Menu and Permission Model

`sys_menus.type` supports:

- `directory`: side menu grouping, no direct route.
- `page`: route-level permission and menu item.
- `button`: action-level permission, used by frontend `<Permission code="...">`.

Only completed pages may be active in `sys_menus`. Runtime menu paths must match frontend routes.

## Data Scope

Customer queries apply role menu `data_scope`:

- `ALL`: all customers.
- `DEPT`: customers in the current user's department.
- `SELF`: customers owned by the current user.

Super admin users bypass data-scope filtering.

## File Storage

Uploaded file binaries are stored on local disk under `UPLOAD_DIR`. Metadata is persisted in `sys_files`. Git must ignore upload directories.
