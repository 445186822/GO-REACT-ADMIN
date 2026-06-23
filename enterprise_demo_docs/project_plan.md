# Enterprise Demo Project Plan

## 0. 成品交付约束

本项目按可交付成品推进，不允许用 mock、占位页、固定演示数据或假接口冒充已完成功能。

- 未接真实数据库、真实后端 API、真实权限校验的功能，不得出现在“已完成”范围。
- 未实现的模块不得出现在后端路由、前端路由、菜单种子数据或 OpenAPI 已发布接口中。
- 后端不得返回固定演示内容、定时假通知、假 SSE 分片或硬编码业务数据。
- 前端不得预填演示账号密码，不得使用占位页面表示业务模块已完成。
- 初始化数据只允许包含系统运行必需的元数据，例如管理员、角色、菜单、权限；业务数据必须由真实用户操作产生或通过正式导入流程进入。
- 管理员初始密码必须来自部署环境变量，不得写死在代码、文档或迁移脚本中。

## 1. 项目定位

本项目不是一次性演示页面，而是一个可复制到企业后续项目的轻量级全栈模板。

目标：
- 轻量：后端 Go 单体 API 起步，避免重框架和过度平台化。
- 现代：Echo + SQLC + OpenAPI + React + Ant Design。
- 可维护：统一错误、统一响应、统一权限、统一数据权限、统一事务、统一审计。
- 可扩展：模块化目录，后续可以扩展审批、报表、AI、实时通知、文件中心。
- AI-ready：后端支持 SSE 流式输出，前端支持 AI 助手和业务上下文摘要。

## 2. 当前项目参考来源

参考 `PrescriptionSystem`：
- 统一响应 `ApiResponse`。
- RBAC：用户、角色、菜单、角色菜单、data_scope。
- 软删除模式。
- WebSocket 聊天和通知。
- 后端测试按模块组织。

参考 `SmartMedicationGuidance`：
- 动态菜单从后端加载。
- 患者端/药师端共用 WebSocket 房间的设计思路。
- `ApiResponse` + `PaginatedResponse` 契约。
- 前端权限码、菜单和 token 存储的分层。

参考 `dbz`：
- SSE AI 流式接口。
- AI assistant 必须接入真实会话、消息持久化和真实流式服务后再开放。
- 审计日志、系统监控、配置中心、数据字典等后台能力。
- 跳过 SSE 路径 gzip 压缩，避免流式输出被缓冲。

## 3. 最终技术栈

后端：
- Go
- Echo
- SQLC
- PostgreSQL
- Redis
- OpenAPI 3.1
- JWT + Refresh Token
- RBAC + Data Scope
- WebSocket
- SSE
- golang-migrate
- slog 或 zap
- Docker Compose

前端：
- React
- TypeScript
- Vite
- Ant Design
- Ant Design ProComponents
- React Router
- TanStack Query
- Zustand
- OpenAPI generated client
- Vitest
- Playwright

## 4. 后端架构

推荐目录：

```text
backend/
  cmd/api/
    main.go
  internal/bootstrap/
  internal/config/
  internal/http/
    middleware/
    response/
    validator/
  internal/auth/
  internal/rbac/
  internal/datascope/
  internal/database/
    sqlc/
    tx/
  internal/cache/
  internal/logger/
  internal/modules/
    user/
    role/
    menu/
    department/
    customer/
    order/
    task/
    approval/
    notification/
    ai/
    file/
    auditlog/
  migrations/
  api/openapi.yaml
```

每个模块固定结构：

```text
handler.go
service.go
queries.sql
mapper.go
dto.go
routes.go
```

职责：
- handler：HTTP 入参、调用 service、返回 response。
- service：业务规则、权限判断、事务边界。
- queries.sql：SQLC 查询定义。
- mapper：SQLC 结果转 API DTO。
- dto：请求和响应结构。
- routes：模块路由注册。

## 5. 前端架构

推荐目录：

```text
frontend/
  src/
    app/
    routes/
    layouts/
    api/
    request/
    store/
    permissions/
    components/
    features/
      user/
      role/
      menu/
      department/
      customer/
      order/
      task/
      approval/
      notification/
      ai/
      file/
      auditlog/
      settings/
    hooks/
    utils/
    styles/
    tests/
```

每个 `features/*` 模块固定结构：

```text
pages/
components/
hooks/
permissions.ts
types.ts
```

数据原则：
- 接口数据用 TanStack Query。
- 登录用户、权限码、菜单、主题用 Zustand。
- 不手写 API 类型，使用 OpenAPI 生成。
- 按钮权限统一用 `<Permission code="xxx">` 包裹。

## 6. 企业级基础能力

必须内置：
- 统一响应结构。
- 统一错误码。
- 统一请求 ID。
- 统一日志。
- 统一鉴权。
- 统一 RBAC。
- 统一数据权限。
- 统一事务封装。
- 统一 SQLC 查询规范。
- 统一 OpenAPI 契约。
- 统一前端 API client。
- 统一审计日志。
- 统一配置管理。
- Docker Compose 一键启动。

## 7. 开发阶段

Phase 1：最小企业骨架
- Docker Compose：PostgreSQL + Redis。
- Backend：Echo 启动、配置、日志、统一响应、统一错误。
- SQLC + migrate 配置。
- OpenAPI 初版。
- JWT 登录、Refresh Token、当前用户接口。
- 用户、角色、菜单、部门基础表。
- React + Ant Design Layout。
- 登录页。
- 用户管理 CRUD。

Phase 2：权限和数据权限
- RBAC 页面权限。
- 按钮权限。
- 后端权限中间件。
- 数据权限：全部、本部门、本人。
- 客户管理作为数据权限示例。

Phase 3：企业业务能力
- 订单主子表。
- 任务状态流转。
- 审批中心。
- 操作日志。
- 文件中心。
- 系统配置。

Phase 4：实时和 AI
- WebSocket 通知。
- SSE AI 助手。
- AI 会话保存。
- 基于业务数据的 AI 摘要。

## 8. 不做什么

第一版不做：
- 微前端。
- 插件市场。
- 低代码平台。
- 复杂 BPMN 引擎。
- 多租户 SaaS 计费。
- 复杂报表设计器。

保留扩展点，但不进入第一阶段，避免项目一开始过重。
