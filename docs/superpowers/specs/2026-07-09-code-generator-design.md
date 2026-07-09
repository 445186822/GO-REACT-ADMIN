# Quick Code Generator Design

## Goal

Add a business example menu named "快速生成代码" that generates standard CRUD source code for selected business tables. The feature is a developer accelerator, not a runtime arbitrary-table editor.

The generated output should follow the existing customer management pattern: Go + Echo backend handler, frontend API wrapper, React + Vite + Ant Design ProTable page, route registration, menu permissions, and migration SQL.

## Scope

The first version supports:

- Scanning database tables whose names start with `biz_`.
- Selecting one table and inspecting its columns.
- Configuring module metadata: feature name, module name, route path, menu icon, and permission prefix.
- Previewing generated files before writing anything.
- Confirming generation to write source files.
- Generating list, create, update, and delete behavior.
- Using soft delete when the table has `deleted_at`.
- Refusing destructive overwrite unless explicitly enabled.

The first version does not support:

- Generating code for `sys_%`, audit, migration, auth, role, menu, user, or other system tables.
- Runtime generic CRUD over arbitrary tables.
- Relationship-aware UI, joins, file upload fields, import/export, workflow binding, or custom dictionary controls.
- Automatically running migrations or restarting services after generation.

## User Flow

1. User opens "业务示例 / 快速生成代码".
2. The page loads eligible tables from the backend.
3. User selects a `biz_` table.
4. The page shows table columns with inferred UI and Go/TypeScript type mappings.
5. User fills generation metadata:
   - Feature name, such as "合同管理".
   - Module name, such as `contract`.
   - Route path, such as `/business/contracts`.
   - Permission prefix, such as `contract`.
   - Menu icon, default `CodeOutlined`.
6. User clicks "生成预览".
7. The page displays generated file paths and code snippets.
8. User clicks "确认生成".
9. Backend validates all inputs again and writes files if safe.
10. Page shows generated file list and next steps: run backend tests, frontend build, and restart the dev system.

## Backend Design

Add a new backend module:

- `backend/internal/modules/codegen/handler.go`

Register routes under `/code-generator`:

- `GET /code-generator/tables`
- `GET /code-generator/tables/:table/columns`
- `POST /code-generator/preview`
- `POST /code-generator/generate`

Permission mapping:

- Read routes use `code-generator:view`.
- Preview and generate use `code-generator:create`.

The backend introspects PostgreSQL metadata through `information_schema.columns` and `pg_catalog` for primary key detection. The table name must pass a strict whitelist check before it is used in SQL or generation:

- Must match `^biz_[a-z0-9_]+$`.
- Must exist in the active schema.
- Must not be a view.
- Must have a single integer-like primary key.

Generated backend CRUD should:

- Use parameterized SQL for values.
- Use validated generated identifiers only for table and column names.
- Exclude `id`, `created_at`, `updated_at`, and `deleted_at` from editable fields.
- Filter `deleted_at IS NULL` when the column exists.
- Soft delete with `deleted_at = now(), updated_at = now()` when possible.
- Return a clear error if delete is requested for a table without `deleted_at`.

## Frontend Design

Add:

- `frontend/src/api/codeGenerator.ts`
- `frontend/src/features/codegen/pages/CodeGeneratorPage.tsx`

The page uses Ant Design and ProComponents, matching the customer management visual style:

- A compact table selector panel.
- A columns preview table.
- A metadata form.
- A generated files preview with tabs or collapsible panels.
- A confirmation modal before writing files.

The page should not expose raw system tables. It only displays tables returned by the backend.

## Generated File Set

For a module named `contract`, route `/business/contracts`, and table `biz_contracts`, the generator writes:

- `backend/internal/modules/contract/handler.go`
- `frontend/src/api/contracts.ts`
- `frontend/src/features/contract/pages/ContractListPage.tsx`
- `backend/migrations/<next>_contract_menu.up.sql`
- `backend/migrations/<next>_contract_menu.down.sql`

It also produces patch instructions or generated snippets for:

- `backend/internal/http/server.go`
- `backend/internal/http/middleware/route_permissions.go`
- `frontend/src/routes/lazyRoutes.ts`
- OpenAPI path entries

For the first implementation, direct file generation can include full new files and migration files. Existing shared files should be handled conservatively: either generate exact patch snippets for the user to review, or apply changes only when the target insertion point is unambiguous.

## Field Mapping

PostgreSQL to UI and TypeScript mapping:

- `text`, `varchar`, `char` -> string, text input.
- `int2`, `int4`, `int8`, `numeric`, `decimal`, `float4`, `float8` -> number, number input.
- `bool` -> boolean, switch/select.
- `date` -> string, date picker.
- `timestamp`, `timestamptz` -> string, date-time display or picker.
- `json`, `jsonb` -> string/object preview, text area in v1.
- Unknown types -> read-only display unless explicitly configured later.

Required frontend form rules are inferred from non-nullable columns without defaults, excluding generated columns and primary keys.

## Safety And Error Handling

Generation must fail before writing any files when:

- The table is not in the `biz_` whitelist.
- The table has no suitable primary key.
- The module name, permission prefix, or route path is invalid.
- A target file already exists and overwrite is not enabled.
- Required insertion points in shared files cannot be found.

The backend should validate preview and generate requests independently. The frontend preview is not trusted.

Generated actions should be audit logged with table name, module name, target files, and current user.

## Testing

Backend tests:

- Table whitelist accepts `biz_customers` and rejects `sys_users`.
- Metadata extraction maps representative PostgreSQL types.
- Preview output includes expected file paths.
- Generate refuses overwrite by default.
- Permission mapping includes `code-generator:view` and `code-generator:create`.

Frontend tests:

- Route registration includes `/business/code-generator`.
- Page contains table selector, preview action, and confirm generation action.
- Page does not allow free-form system table entry.

Verification commands:

- `cd backend && go test ./...`
- `cd frontend && npm run build`

## Rollout Notes

Add menu data under the existing business parent:

- Name: `快速生成代码`
- Path: `/business/code-generator`
- Component: `CodeGeneratorPage`
- Icon: `CodeOutlined`
- Permission: `code-generator:view`

Grant the menu and create permission to `ADMIN` in migration SQL. Other roles can be granted from the role management page.
