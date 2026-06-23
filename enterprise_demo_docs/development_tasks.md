# Development Tasks

## 0. 无 mock 验收规则

每个阶段只有在真实数据库表、真实 API、真实前端页面、权限控制、错误处理和基础验证完成后，才能标记为完成。

- 禁止前端 mock 登录、mock 菜单、mock 表格数据、占位页。
- 禁止后端固定返回演示数据、假 WebSocket 通知、假 SSE 内容。
- 禁止自动插入示例客户、示例订单、示例任务等业务数据。
- 未完成模块必须保持不可见：不注册菜单、不注册前端路由、不注册后端假接口。
- OpenAPI 只能发布已经实现并通过验证的接口。

## 1. 阶段目标

本任务清单按可交付顺序组织。

第一目标：
- 先做出可运行、可登录、可 CRUD 的企业骨架。

第二目标：
- 加入权限、数据权限、审计，形成企业级基础能力。

第三目标：
- 加入 WebSocket、SSE AI、主子表、审批，体现 demo 差异化。

## 2. Phase 0：项目初始化

任务：
- 创建 monorepo 目录：`enterprise-demo/backend`、`enterprise-demo/frontend`。
- 创建 Docker Compose。
- 配置 PostgreSQL。
- 配置 Redis。
- 创建 README。
- 创建 Makefile 或 task 脚本。

验收：
- `docker compose up -d` 能启动 PostgreSQL 和 Redis。
- 后端可读取环境变量。
- 前端 Vite 可启动。

## 3. Phase 1：后端基础骨架

任务：
- 初始化 Go module。
- 接入 Echo。
- 接入配置加载。
- 接入结构化日志。
- 实现 request_id 中间件。
- 实现 recover 中间件。
- 实现 CORS。
- 实现统一响应。
- 实现统一错误码。
- 实现统一 HTTPErrorHandler。
- 创建 health 接口。

接口：
- `GET /health`
- `GET /api/v1/health`

验收：
- 服务启动。
- 错误响应格式统一。
- 日志中包含 request_id。

## 4. Phase 2：数据库、迁移、SQLC

任务：
- 配置 golang-migrate。
- 配置 SQLC。
- 创建第一批迁移。
- 创建系统表：users、roles、menus、departments、role_menus、user_roles。
- 创建种子数据。
- 封装 DB 连接。
- 封装事务 helper。

验收：
- 可以执行 migrate up/down。
- SQLC 可以生成代码。
- 种子数据包含 admin 账号。

## 5. Phase 3：认证

任务：
- 实现密码 hash。
- 实现 JWT access token。
- 实现 refresh token。
- 实现登录。
- 实现刷新 token。
- 实现退出登录。
- 实现当前用户接口。
- 实现 auth middleware。

接口：
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

验收：
- admin 可登录。
- 登录后能获取用户、菜单、权限码。
- 未登录访问受保护接口返回 AUTH_INVALID_TOKEN。

## 6. Phase 4：前端基础骨架

任务：
- 初始化 React + TypeScript + Vite。
- 接入 Ant Design。
- 接入 ProComponents。
- 接入 React Router。
- 接入 TanStack Query。
- 接入 Zustand。
- 配置 request client。
- 配置 OpenAPI generated client。
- 实现 AuthLayout。
- 实现 BasicLayout。
- 实现登录页。
- 实现路由守卫。
- 实现菜单渲染。

验收：
- 前端可登录。
- 登录后进入后台 Layout。
- 菜单来自 `/auth/me`。
- 无权限路由被拦截。

## 7. Phase 5：用户 CRUD

任务：
- 后端实现用户列表、新增、编辑、删除、启用禁用、重置密码。
- 前端实现用户管理页。
- 接入按钮权限。
- 接入分页和搜索。

接口：
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{id}`
- `PUT /api/v1/users/{id}`
- `DELETE /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}/status`
- `POST /api/v1/users/{id}/reset-password`

验收：
- 用户 CRUD 完整可用。
- 无权限用户看不到新增、删除按钮。
- 后端无权限调用返回 AUTH_PERMISSION_DENIED。

## 8. Phase 6：RBAC

任务：
- 实现角色 CRUD。
- 实现菜单管理。
- 实现角色菜单授权。
- 实现权限码生成。
- 实现后端权限中间件。
- 前端实现 `<Permission code="">`。

验收：
- 不同角色登录看到不同菜单。
- 不同角色看到不同按钮。
- 后端强制校验接口权限。

## 9. Phase 7：数据权限

任务：
- 实现部门管理。
- 实现 data_scope 计算。
- 创建客户表。
- 实现客户 CRUD。
- 客户列表 SQLC 查询接入 data_scope。
- 前端显示当前账号数据范围。

验收：
- admin 看全部客户。
- manager 看本部门客户。
- staff 只看自己客户。
- 直接调用详情接口也受数据权限限制。

## 10. Phase 8：审计日志

任务：
- 创建 audit_logs 表。
- 实现审计中间件。
- 记录非 GET 请求。
- 实现操作日志查询页。

验收：
- 新增、编辑、删除用户会记录日志。
- 日志可按用户、资源、时间查询。
- 日志包含 request_id。

## 11. Phase 9：订单主子表

任务：
- 创建 orders、order_items 表。
- 实现订单创建、编辑、详情、删除。
- service 层使用事务。
- 前端实现订单主子表表单。

验收：
- 订单和明细事务保存。
- 金额自动计算。
- 保存失败时不会产生半条数据。

## 12. Phase 10：任务和审批

任务：
- 创建 tasks 表。
- 实现任务状态流转。
- 创建 approvals、approval_records 表。
- 实现提交、通过、驳回。
- 前端实现审批中心。

验收：
- 非法状态流转被拒绝。
- 审批记录形成时间线。

## 13. Phase 11：WebSocket 通知

任务：
- 实现 WebSocket manager。
- 实现通知表。
- 实现通知 REST API。
- 用户登录后建立 WebSocket。
- 任务分配、审批待办触发通知。

验收：
- 新通知实时出现。
- 未读数量实时更新。
- 断线后可重连。

## 14. Phase 12：SSE AI 助手

任务：
- 实现 AI 会话表。
- 实现 AI 消息表。
- 实现 SSE stream。
- 前端实现 AI 聊天页。
- 支持停止生成。
- 支持保存会话。

验收：
- AI 响应逐字/分片输出。
- 停止生成可用。
- 历史会话可查看。

## 15. Phase 13：文件中心和系统配置

任务：
- 实现文件上传下载。
- 实现文件中心页面。
- 实现系统配置表。
- 配置读写接入 Redis 缓存。

验收：
- 文件可上传、下载、删除。
- 配置修改后缓存刷新。

## 16. 测试策略

后端：
- 单元测试：service、权限、data_scope。
- 集成测试：auth、user CRUD、RBAC、data scope。
- 数据库测试：可用 testcontainers 或测试库。

前端：
- Vitest：权限组件、hooks、工具函数。
- Playwright：登录、用户 CRUD、权限隐藏、AI SSE。

## 17. 第一阶段最小验收标准

第一阶段完成条件：
- Docker Compose 能启动数据库和 Redis。
- 后端启动成功。
- 前端启动成功。
- admin 能登录。
- 后台 Layout 可进入。
- 用户管理 CRUD 可用。
- OpenAPI client 可生成。
- SQLC 查询可生成。
- README 说明清楚启动步骤。
