# API Design

The backend exposes REST APIs under `/api/v1`. Responses use a unified envelope:

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

Authenticated APIs enforce backend permission codes derived from route and method. Frontend button visibility is only a usability layer; direct API calls still require matching permissions.

## Public and Auth

- `GET /health`, `GET /api/v1/health`: health checks.
- `GET /api/v1/auth/captcha`: slider captcha challenge.
- `POST /api/v1/auth/captcha/verify`: captcha verification.
- `POST /api/v1/auth/login`: database-backed login.
- `POST /api/v1/auth/refresh`: issue a new access token.
- `GET /api/v1/auth/me`: current user, permission codes, and menu tree.
- `PUT /api/v1/auth/password`: change current user's password.

## System and Operations

- Users: `GET|POST /users`, `PUT|DELETE /users/{id}`, `PUT /users/{id}/reset-password`.
- Roles: `GET|POST /roles`, `PUT|DELETE /roles/{id}`, `GET|PUT /roles/{id}/menus`.
- Menus and departments: `GET /menus`, `GET /departments`.
- Settings: `GET /settings`, `PUT /settings/{key}`.
- Data dictionary: `/dict/types`, `/dict/types/tree`, `/dict/types/{id}`, `/dict/types/{id}/items`, `/dict/items/{id}`, `/dict/items/batch-sort`.
- Recycle bin: `GET|DELETE /recycle-bin`, `DELETE /recycle-bin/{id}`, `POST /recycle-bin/{id}/restore`.
- Scheduler: `/scheduler/tasks`, `/scheduler/tasks/{id}`, `/scheduler/tasks/{id}/toggle`, `/scheduler/tasks/{id}/run`, `/scheduler/tasks/{id}/executions`.
- Monitor and dashboard: `GET /monitor/overview`, `GET /monitor/db-stats`, `GET /dashboard/stats`.

## Business, Files, Audit, and Knowledge

- Customers: `GET|POST /customers`, `PUT|DELETE /customers/{id}`, `POST /customers/export`, `POST /customers/import`.
- Files: `GET /files`, `POST /files/upload`, `GET /files/{id}/download`, `DELETE /files/{id}`.
- Audit logs: `GET /audit-logs`, `GET /audit-logs/{id}`.
- Knowledge base: `/kb/categories`, `/kb/categories/tree`, `/kb/categories/{id}`, `/kb/articles`, `/kb/articles/{id}`, `/kb/faqs`, `/kb/faqs/{id}`.

## Collaboration, Workflow, and AI

- Notifications: `/notifications`, `/notifications/unread-count`, `/notifications/{id}/read`, `/notifications/read-all`, `/notifications/ws`.
- Message templates: `GET|POST /message-templates`, `PUT|DELETE /message-templates/{id}`.
- Approvals: `GET|POST /approval/instances`, `GET /approval/instances/{id}`, `POST /approval/instances/{id}/action`.
- Workflows: `GET|POST /workflows`, `PUT|DELETE /workflows/{id}`, `POST /workflows/{id}/run`, `GET /workflows/instances`, `GET /workflows/instances/{id}`.
- AI assistant: `GET /ai-assistant/messages`, `POST /ai-assistant/chat`.
- Streaming AI chat: `POST /ai/chat`, `GET /ai/history`.

## Instant Messaging

- `GET|POST /chat/sessions`: list and create sessions.
- `GET|PUT /chat/sessions/{id}`: session detail and title/status update.
- `GET|POST /chat/sessions/{id}/messages`: list and send messages.
- `POST /chat/sessions/{id}/messages/{message_id}/revoke`: revoke a message.
- `PUT /chat/sessions/{id}/read`: mark a session read.
- `PUT /chat/sessions/{id}/settings`: update current participant settings.
- `POST /chat/sessions/{id}/participants`: add participants.
- `DELETE /chat/sessions/{id}/participants/{user_id}`: remove or leave participant.
- `GET /chat/users`: search active users for chat.
- `GET /chat/ws`: chat WebSocket endpoint.

## Queue and IoT Protocol Lab

- Kafka: `/queue-lab/kafka/concepts`, `/queue-lab/kafka/topics`, `/queue-lab/kafka/messages`, `/queue-lab/kafka/consume`.
- RabbitMQ: `/queue-lab/rabbitmq/concepts`, `/queue-lab/rabbitmq/queues`, `/queue-lab/rabbitmq/exchanges`, `/queue-lab/rabbitmq/messages`, `/queue-lab/rabbitmq/consume`.
- IoT protocols: `GET /queue-lab/iot/{protocol}/concepts`, `POST /queue-lab/iot/{protocol}/messages`, where `{protocol}` is `tcp`, `udp`, or `mqtt`.

IoT protocol messages are wrapped as JSON events and bridged to a selected Kafka topic or RabbitMQ queue. Kafka topics are confirmed/created before publish; RabbitMQ queues are declared before publish.

## Runtime Visibility Rule

Only implemented APIs are documented and registered. Do not publish planned modules in OpenAPI until database, handler, permission mapping, frontend route, validation, and verification exist.
