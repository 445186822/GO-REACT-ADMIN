# API Design

The backend exposes authenticated REST APIs under `/api/v1`. Responses use a unified envelope:

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

Errors use the same envelope with an HTTP status and stable error code.

Authenticated business APIs enforce backend permission codes derived from the request route and method. Frontend button visibility is only a usability layer; direct API calls still require the matching menu or button permission.

## Public Health

- `GET /health`
- `GET /api/v1/health`

## Authentication

- `POST /api/v1/auth/login`: login with database-backed user credentials.
- `POST /api/v1/auth/refresh`: issue a new access token.
- `GET /api/v1/auth/me`: return current user, permission codes, and menu tree.

## System APIs

- `GET /api/v1/users`: paged user list.
- `POST /api/v1/users`: create user.
- `PUT /api/v1/users/{id}`: update user.
- `DELETE /api/v1/users/{id}`: soft delete user.
- `GET /api/v1/roles`: list roles.
- `GET /api/v1/menus`: list menus and permission metadata.
- `GET /api/v1/departments`: list departments.

## Business APIs

- `GET /api/v1/customers`: paged customer list with data-scope filtering.
- `POST /api/v1/customers`: create customer.
- `PUT /api/v1/customers/{id}`: update customer.
- `DELETE /api/v1/customers/{id}`: soft delete customer.
- `POST /api/v1/customers/export`: backend-generated `.xlsx` download for authorized customer data.

## File, Audit, and Settings APIs

- `GET /api/v1/files`: paged uploaded file list.
- `POST /api/v1/files/upload`: upload a file.
- `GET /api/v1/files/{id}/download`: backend file stream download.
- `DELETE /api/v1/files/{id}`: soft delete file metadata.
- `GET /api/v1/audit-logs`: paged persisted audit logs.
- `GET /api/v1/audit-logs/{id}`: audit log detail.
- `GET /api/v1/settings`: list system settings, filterable by `group_key` and `keyword`.
- `PUT /api/v1/settings/{key}`: create or update a setting.

## Knowledge Base APIs

- `GET|POST /api/v1/kb/categories`: list or create categories.
- `DELETE /api/v1/kb/categories/{id}`: delete only when the category has no child categories, articles, or FAQs; otherwise returns `409 KB_CATEGORY_IN_USE`.
- `GET|POST /api/v1/kb/articles`: paged article list and create. Lists support `keyword`, `category_id`, and `status`.
- `GET|PUT|DELETE /api/v1/kb/articles/{id}`: article detail, update, and soft delete.
- `GET|POST /api/v1/kb/faqs`: paged FAQ list and create. Lists support `keyword`, `category_id`, and `status`.

## Collaboration APIs

- `GET /api/v1/notifications`: paged notifications.
- `POST /api/v1/notifications`: create a persisted notification.
- `GET /api/v1/notifications/unread-count`: current unread count.
- `PUT /api/v1/notifications/{id}/read`: mark one notification as read.
- `PUT /api/v1/notifications/read-all`: mark visible notifications as read.
- `GET /api/v1/notifications/ws`: WebSocket unread/change events using `token` query auth.
- `GET|POST|PUT|DELETE /api/v1/message-templates`: message template management. Lists support `keyword`, `category`, and `status`.
- `GET|POST /api/v1/approval/instances`: list and submit approval instances. Submitted instances bind directly to an approval workflow via `workflow_definition_id`; lists support `keyword`, `biz_type`, and `status`.
- `POST /api/v1/approval/instances/{id}/action`: approve or reject an instance.
- `GET|POST|PUT|DELETE /api/v1/workflows`: workflow definition management. Lists support `keyword`, `category`, and `status`.
- `POST /api/v1/workflows/{id}/run`: create a workflow run instance.
- `GET /api/v1/workflows/instances`: list workflow runs.
- `GET /api/v1/ai-assistant/messages`: current user's stored AI chat messages.
- `POST /api/v1/ai-assistant/chat`: forward a message to the configured AI provider and store the reply.

## Runtime Visibility Rule

Only implemented APIs are documented and registered. Do not publish planned modules in OpenAPI until the database, handler, permissions, frontend route, and validation path exist.
