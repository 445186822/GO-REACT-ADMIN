# Database Design

The application uses PostgreSQL. Migrations live in `backend/migrations/` and are applied by the backend migration runner at startup.

## Core System Tables

- `schema_migrations`: applied migration versions.
- `sys_users`: login users, profile fields, status, department relation, password hash, and super-admin flag.
- `sys_roles`: role metadata.
- `sys_user_roles`: user-role assignments.
- `sys_menus`: directories, pages, and button permissions in one tree.
- `sys_role_menus`: role-menu assignments plus `data_scope`.
- `sys_departments`: department hierarchy metadata.
- `sys_settings`: persisted system settings.
- `sys_audit_logs`: non-GET API audit records.
- `sys_files`: uploaded file metadata and storage path.
- `sys_recycled`: recycle-bin records for soft-deleted entities.
- `auth_captcha_challenges`: slider captcha challenge state.

Mutable system and business tables use soft deletion through `deleted_at` where applicable.

## Business and Content Tables

- `biz_customers`: customer records for CRUD, soft delete, owner/department fields, and data-scope filtering.
- `sys_dict_types`, `sys_dict_items`: data dictionary metadata.
- `kb_categories`, `kb_articles`, `kb_faqs`: knowledge base content.

Customer data is real user-created data. Seed data must not include fake business records.

## Collaboration, Workflow, and AI Tables

- `sys_notifications`: persisted notifications with read state and optional recipient.
- `msg_templates`: reusable message templates with JSON variables.
- `workflow_definitions`, `workflow_instances`, `workflow_logs`: workflow definitions, run records, and execution logs.
- `workflow_bindings`, `workflow_status_mappings`: workflow-to-business bindings and status mapping rules.
- `approval_instances`, `approval_actions`, `approval_instance_nodes`: workflow-backed approval runtime records and action history.
- `ai_assistant_messages`: stored AI assistant user and assistant messages.
- `ai_chat_history`: streaming AI chat history.

## Instant Messaging Tables

- `chat_sessions`: one-to-one and group conversation metadata.
- `chat_participants`: participant settings, unread/read state, pinned/muted state, and per-user removal state.
- `chat_messages`: text, image, file, system, reply, recall, and attachment metadata.

Session deletion is per participant through `removed_at`; messages remain persisted for other active participants.

## Scheduler and Runtime Tables

- `sys_scheduled_tasks`: scheduler task definitions.
- `sys_task_executions`: scheduler run history.

Queue and IoT protocol lab pages use external Kafka and RabbitMQ infrastructure. They do not persist broker messages in PostgreSQL; operation history displayed in the browser is local UI history.

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
