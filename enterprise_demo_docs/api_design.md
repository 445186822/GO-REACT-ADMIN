# API Design

## 0. API 无 mock 规则

API 文档只描述已经实现或明确待实现的真实接口，不允许把 mock、测试流、固定响应或占位接口作为正式 API。

- 所有正式接口必须访问真实持久化数据或真实外部服务。
- SSE、WebSocket、AI、通知类接口不得返回固定演示内容。
- 未实现接口不得注册到后端路由。
- OpenAPI 中标为可用的接口必须与后端实现保持一致。

## 1. API 设计原则

接口采用 REST 风格，统一前缀：

```text
/api/v1
```

目标：
- OpenAPI 先行或同步维护。
- 前端 API client 从 OpenAPI 生成。
- 所有响应统一结构。
- 所有错误统一错误码。
- 所有列表统一分页结构。
- 权限和数据权限后端必须校验，前端隐藏按钮只是体验优化。

## 2. 统一响应

成功响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

分页响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

错误响应：

```json
{
  "code": "USER_NOT_FOUND",
  "message": "user not found",
  "data": null,
  "request_id": "req_xxx"
}
```

## 3. 错误码分类

建议：
- AUTH_INVALID_TOKEN
- AUTH_TOKEN_EXPIRED
- AUTH_PERMISSION_DENIED
- VALIDATION_ERROR
- RESOURCE_NOT_FOUND
- RESOURCE_CONFLICT
- DATA_SCOPE_DENIED
- BUSINESS_RULE_FAILED
- DATABASE_ERROR
- INTERNAL_ERROR

Echo 中通过统一 `HTTPErrorHandler` 收口。

## 4. 认证接口

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

`/auth/me` 返回：
- 当前用户信息。
- 菜单树。
- 权限码列表。
- 角色列表。
- data_scope 摘要。

## 5. 用户管理

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}
PATCH  /api/v1/users/{id}/status
POST   /api/v1/users/{id}/reset-password
```

权限码：
- user:view
- user:create
- user:update
- user:delete
- user:reset_password

## 6. 角色管理

```text
GET    /api/v1/roles
POST   /api/v1/roles
GET    /api/v1/roles/{id}
PUT    /api/v1/roles/{id}
DELETE /api/v1/roles/{id}
GET    /api/v1/roles/{id}/menus
PUT    /api/v1/roles/{id}/menus
```

权限码：
- role:view
- role:create
- role:update
- role:delete
- role:assign_menu

## 7. 菜单管理

```text
GET    /api/v1/menus/tree
POST   /api/v1/menus
PUT    /api/v1/menus/{id}
DELETE /api/v1/menus/{id}
```

权限码：
- menu:view
- menu:create
- menu:update
- menu:delete

## 8. 部门管理

```text
GET    /api/v1/departments/tree
POST   /api/v1/departments
PUT    /api/v1/departments/{id}
DELETE /api/v1/departments/{id}
```

权限码：
- department:view
- department:create
- department:update
- department:delete

## 9. 客户管理

用于展示普通 CRUD + 数据权限。

```text
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/{id}
PUT    /api/v1/customers/{id}
DELETE /api/v1/customers/{id}
POST   /api/v1/customers/export
```

权限码：
- customer:view
- customer:create
- customer:update
- customer:delete
- customer:export

后端必须根据当前用户角色的 data_scope 过滤列表和详情。

## 10. 订单管理

用于展示主子表 + 事务。

```text
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/{id}
PUT    /api/v1/orders/{id}
DELETE /api/v1/orders/{id}
POST   /api/v1/orders/{id}/submit
```

权限码：
- order:view
- order:create
- order:update
- order:delete
- order:submit

## 11. 任务管理

用于展示状态流转。

```text
GET  /api/v1/tasks
POST /api/v1/tasks
GET  /api/v1/tasks/{id}
PUT  /api/v1/tasks/{id}
POST /api/v1/tasks/{id}/transition
```

状态流转在后端校验。

## 12. 审批中心

```text
GET  /api/v1/approvals
GET  /api/v1/approvals/{id}
POST /api/v1/approvals/{id}/approve
POST /api/v1/approvals/{id}/reject
GET  /api/v1/approvals/{id}/records
```

权限码：
- approval:view
- approval:approve
- approval:reject

## 13. 通知与 WebSocket

REST：

```text
GET  /api/v1/notifications
POST /api/v1/notifications/{id}/read
POST /api/v1/notifications/read-all
```

WebSocket：

```text
GET /api/v1/ws/notifications?token=xxx
```

消息类型：
- notification.created
- task.assigned
- approval.pending
- system.broadcast

## 14. AI 助手与 SSE

```text
POST /api/v1/ai/chat
GET  /api/v1/ai/chat/stream?session_id=xxx
POST /api/v1/ai/chat/{session_id}/stop
GET  /api/v1/ai/sessions
GET  /api/v1/ai/sessions/{id}/messages
```

也可以第一版采用 POST SSE：

```text
POST /api/v1/ai/chat/stream
```

响应 media type：

```text
text/event-stream
```

必须注意：
- SSE 路径跳过 gzip 缓冲。
- 支持停止生成。
- 保存用户消息和 assistant 消息。

## 15. 文件中心

```text
GET    /api/v1/files
POST   /api/v1/files/upload
GET    /api/v1/files/{id}/download
DELETE /api/v1/files/{id}
```

第一版可用本地存储，后续扩展 MinIO/S3。

## 16. 操作日志

```text
GET /api/v1/audit-logs
GET /api/v1/audit-logs/{id}
```

由中间件自动记录非 GET 操作。

## 17. 系统配置

```text
GET /api/v1/settings
PUT /api/v1/settings/{key}
```

配置更新后刷新 Redis 缓存。
