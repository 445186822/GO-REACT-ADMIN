# Frontend Pages

The frontend is a React + TypeScript + Vite admin app using Ant Design and Ant Design ProComponents.

## Routing and Menu Rules

Lazy enterprise routes live in `frontend/src/routes/lazyRoutes.ts` and are mounted by `frontend/src/routes/AppRouter.tsx`. The menu tree is loaded from `/api/v1/auth/me` and rendered by `BasicLayout`.

Do not add placeholder routes. If a module is not backed by real database tables or external infrastructure integration, backend APIs, permissions, and UI behavior, it must not appear in the menu.

## Current Pages

- `/login`: database-backed login with captcha flow.
- `/dashboard`: dashboard statistics from backend APIs.
- `/system/users`: user list, create, update, soft delete, reset password, and export.
- `/system/roles`: role list, role menu assignment, and export.
- `/system/menus`: tree-structured menu and permission management with create, update, delete, and export actions.
- `/system/departments`: department list.
- `/system/data-dict`: dictionary types and dictionary items.
- `/system/recycle-bin`: restore, purge one, and purge all recycled records.
- `/system/monitor`: system and database monitor overview.
- `/system/scheduler`: task CRUD, enable/disable, manual run, and execution history.
- `/system/architecture`: architecture overview page.
- `/business/customers`: customer CRUD, data-scope API integration, backend XLSX export, backend import-template download, and XLSX import.
- `/collaboration/todos`: current user's actionable workflow approval tasks.
- `/collaboration/notifications`: persisted notification list, unread state, read actions, create notification, and WebSocket unread updates.
- `/collaboration/message-templates`: message template CRUD with JSON variables.
- `/collaboration/approvals`: workflow-backed approval instance submission, approve, reject, detail, and history views.
- `/collaboration/workflows`: workflow definition CRUD, business bindings, manual run, and run instance list.
- `/collaboration/ai-assistant`: persisted AI assistant messages and provider forwarding through backend configuration.
- `/collaboration/chat`: internal instant messaging with sessions, participants, attachments, recall, read state, and WebSocket updates. It is grouped under the runtime `消息与协议` menu.
- `/system/queue-lab/kafka`: Kafka topic creation, message publish, and offset-based consumption.
- `/system/queue-lab/rabbitmq`: RabbitMQ queue declaration, message publish, and ack/nack consumption.
- `/system/queue-lab/tcp`: IoT TCP ingress simulation bridged to Kafka or RabbitMQ.
- `/system/queue-lab/udp`: IoT UDP ingress simulation bridged to Kafka or RabbitMQ.
- `/system/queue-lab/mqtt`: IoT MQTT publish simulation bridged to Kafka or RabbitMQ.
- `/files`: upload, list, backend file download, soft delete, and file-list export.
- `/logs/operation`: audit log list.
- `/settings`: list and upsert settings.
- `/knowledge-base`: categories, articles, FAQs, and content management.

Unknown routes render a 404 page instead of redirecting to the dashboard.

## Runtime Menu Grouping

The seed menu groups real-time messaging and protocol demos under `消息与协议`:

- Kafka体验
- RabbitMQ体验
- TCP体验
- UDP体验
- MQTT体验
- 即时通讯

The route paths are unchanged, so bookmarks and permission mapping continue to use the existing route paths.

## Download Source Labels

Download buttons distinguish source:

- `前端`: browser-generated XLSX.
- `后端`: backend-generated file stream or backend XLSX response.

Customer export and file downloads are backend downloads. Other list exports may be frontend-generated unless the module has a dedicated backend export endpoint.

## State and API Access

- Auth state, current user, menu tree, and permissions are stored in Zustand.
- API calls use `frontend/src/request/http.ts`.
- Permission-gated buttons use `frontend/src/components/Permission.tsx`.

## Build Verification

```bash
cd frontend
npm run build
```

Full frontend unit coverage:

```bash
cd frontend
npx vitest run src
```
